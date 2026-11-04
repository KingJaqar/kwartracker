package expo.modules.kwartrackerfoundation

import android.os.Build
import android.os.SystemClock
import android.system.Os
import android.system.OsConstants
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/** Nonshipping synthetic capability tests. No arbitrary paths, passwords or database input. */
class FoundationProbesModule : Module() {
  private val storageLock = Any()

  override fun definition() = ModuleDefinition {
    Name("KwartrackerFoundationProbes")

    AsyncFunction("probePbkdf2") {
      require(Build.VERSION.SDK_INT >= 26) { "PBKDF2-HMAC-SHA-256 requires Android API 26 or newer." }
      val password = "246813".toCharArray()
      val salt = ByteArray(16) { it.toByte() }
      val expected = "a0616cdcf5c1d42284c556043fb6aebb9ae3e161802b53a9e0ba1508aed5ec6b"
        .chunked(2).map { it.toInt(16).toByte() }.toByteArray()
      val specification = PBEKeySpec(password, salt, 600000, 256)
      var derived: ByteArray? = null
      try {
        val started = SystemClock.elapsedRealtimeNanos()
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val output = factory.generateSecret(specification).encoded
        derived = output
        check(output.size == 32)
        val matches = MessageDigest.isEqual(output, expected)
        val milliseconds = (SystemClock.elapsedRealtimeNanos() - started) / 1000000.0
        mapOf(
          "candidate" to "Android SecretKeyFactory PBKDF2WithHmacSHA256 (unselected)",
          "provider" to factory.provider.name,
          "apiLevel" to Build.VERSION.SDK_INT,
          "iterations" to 600000,
          "outputBits" to 256,
          "saltBits" to 128,
          "milliseconds" to milliseconds,
          "within750ms" to (milliseconds <= 750),
          "vectorMatches" to matches,
          "comparison" to "MessageDigest.isEqual, separate fixed 32-byte arrays; platform implementation review pending"
        )
      } finally {
        specification.clearPassword()
        password.fill('\u0000')
        salt.fill(0)
        expected.fill(0)
        derived?.fill(0)
      }
    }

    AsyncFunction("probeDurableIo") {
      synchronized(storageLock) {
        val parent = appContext.persistentFilesDirectory
        val root = File(parent, "foundation-native-probes")
        if (!root.exists()) check(root.mkdir())
        syncDirectory(parent)
        val operation = UUID.randomUUID().toString()
        val folder = File(root, operation)
        check(folder.mkdir())
        syncDirectory(root)
        val live = File(folder, "live.marker")
        val staged = File(folder, "staged.marker")
        val rollback = File(folder, "rollback.marker")
        writeSynced(live, "old-complete")
        writeSynced(staged, "new-complete")
        syncDirectory(folder)
        val journal = File(folder, "journal.json")
        writeAtomic(journal, "{\"synthetic\":true,\"operation\":\"$operation\",\"phase\":\"STAGING_VALIDATED\"}")
        Os.rename(live.path, rollback.path)
        syncDirectory(folder)
        writeAtomic(journal, "{\"synthetic\":true,\"operation\":\"$operation\",\"phase\":\"OLD_RENAMED\"}")
        Os.rename(staged.path, live.path)
        syncDirectory(folder)
        writeAtomic(journal, "{\"synthetic\":true,\"operation\":\"$operation\",\"phase\":\"NEW_RENAMED\"}")
        check(live.readText() == "new-complete" && rollback.readText() == "old-complete")
        mapOf(
          "operation" to operation,
          "fileDescriptorSync" to "returned successfully",
          "sameDirectoryRename" to "returned successfully",
          "parentDirectoryFsync" to "returned successfully",
          "journalReplacement" to journal.readText(),
          "rollbackRetained" to rollback.exists(),
          "scope" to "Synthetic marker files only; combine with SQLite/WAL and interruption/device-state matrix before S1 can pass"
        )
      }
    }

    // Restricted to disposable UUID sandboxes and fixed names. Never accepts a product DB path.
    AsyncFunction("restoreIo") { operation: String, action: String, first: String, second: String ->
      synchronized(storageLock) {
        val root = File(appContext.persistentFilesDirectory, "foundation-restore-probes")
        if (!root.exists()) { check(root.mkdir()); syncDirectory(requireNotNull(root.parentFile)) }
        if (action == "create") {
          require(operation.isEmpty() && first.isEmpty() && second.isEmpty())
          val id = UUID.randomUUID().toString()
          check(File(root, id).mkdir())
          syncDirectory(root)
          id
        } else {
          require(operation.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")))
          val folder = File(root, operation)
          check(folder.isDirectory && folder.canonicalFile.parentFile == root.canonicalFile)
          val names = setOf("live.db", "staged.db", "rollback.db", "journal.json", "device.json", "baseline.json")
          when (action) {
            "directory" -> { require(first.isEmpty() && second.isEmpty()); folder.absolutePath }
            "exists" -> { require(first in names && second.isEmpty()); File(folder, first).exists().toString() }
            "hash" -> {
              require(first in setOf("live.db", "staged.db", "rollback.db") && second.isEmpty())
              val file = File(folder, first)
              require(file.isFile && file.length() <= 16777216)
              MessageDigest.getInstance("SHA-256").digest(file.readBytes()).joinToString("") { "%02x".format(it.toInt() and 255) }
            }
            "read" -> {
              require(first in setOf("journal.json", "device.json", "baseline.json") && second.isEmpty())
              val file = File(folder, first)
              if (file.exists()) { require(file.length() <= 32768); file.readText() } else ""
            }
            "write" -> {
              require(first in setOf("journal.json", "device.json", "baseline.json") && second.toByteArray().size <= 32768)
              writeAtomic(File(folder, first), second)
              "ok"
            }
            "sync" -> {
              require(first in setOf("live.db", "staged.db") && second.isEmpty())
              for (suffix in listOf("-wal", "-shm", "-journal")) {
                val sidecar = File(folder, first + suffix)
                check(!sidecar.exists() || sidecar.length() == 0L) { "SQLite sidecar remains active" }
              }
              val file = File(folder, first)
              Os.chmod(file.path, 384) // Owner read/write only, including replacement metadata.
              val descriptor = Os.open(file.path, OsConstants.O_RDONLY, 0)
              try { Os.fsync(descriptor) } finally { Os.close(descriptor) }
              syncDirectory(folder)
              "ok"
            }
            "rename" -> {
              require((first to second) in setOf("live.db" to "rollback.db", "staged.db" to "live.db", "live.db" to "staged.db", "rollback.db" to "live.db"))
              check(!File(folder, second).exists())
              Os.rename(File(folder, first).path, File(folder, second).path)
              syncDirectory(folder)
              "ok"
            }
            "remove" -> {
              require(first in setOf("rollback.db", "staged.db", "journal.json") && second.isEmpty())
              val file = File(folder, first)
              if (file.exists()) check(file.delete())
              syncDirectory(folder)
              "ok"
            }
            "corrupt" -> {
              require(first == "live.db" && second.isEmpty())
              writeSynced(File(folder, first), "SYNTHETIC-CORRUPT-DATABASE")
              syncDirectory(folder)
              "ok"
            }
            else -> error("Unsupported synthetic operation")
          }
        }
      }
    }
  }

  private fun writeSynced(file: File, contents: String) {
    FileOutputStream(file).use { output ->
      output.write(contents.toByteArray(Charsets.UTF_8))
      output.fd.sync()
    }
  }

  private fun writeAtomic(file: File, contents: String) {
    val directory = requireNotNull(file.parentFile)
    val temporary = File(directory, "${file.name}.tmp")
    writeSynced(temporary, contents)
    Os.rename(temporary.path, file.path)
    syncDirectory(directory)
  }

  private fun syncDirectory(directory: File) {
    check(directory.isDirectory)
    val descriptor = Os.open(directory.path, OsConstants.O_RDONLY, 0)
    try { Os.fsync(descriptor) } finally { Os.close(descriptor) }
  }
}
