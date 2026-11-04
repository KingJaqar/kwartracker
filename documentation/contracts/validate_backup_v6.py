"""Documentation fixture oracle, not application restore or native durability proof.

Run: python documentation/contracts/validate_backup_v6.py
Requires the already available jsonschema package; no install is performed.
"""
from pathlib import Path
import datetime as dt
import hashlib
import json
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from jsonschema import Draft202012Validator, FormatChecker

HERE = Path(__file__).parent
FIXTURES = HERE.parent / 'fixtures' / 'backup-v6'
SCHEMA = json.loads((HERE / 'backup-v6.schema.json').read_text(encoding='utf-8'))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())

class Failure(Exception):
    pass

def require(condition, explanation):
    if not condition:
        raise Failure(explanation)

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')

def sha(value):
    return hashlib.sha256(canonical(value)).hexdigest()

def pairs(values):
    result = {}
    for key, value in values:
        if key in result:
            raise ValueError('Duplicate JSON property')
        result[key] = value
    return result

def no_float(value):
    raise ValueError('Only integer numeric tokens are supported')

def day(value):
    return dt.date.fromisoformat(value)

def instant(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))

def unique(rows, key='id'):
    result = {}
    for row in rows:
        value = row[key]
        require(value not in result, 'Duplicate ' + key)
        result[value] = row
    return result

def semantic(data):
    accounts = unique(data['Account'])
    cats = unique(data['Category'])
    transactions = unique(data['Transaction'])
    budgets = unique(data['Budget'])
    rules = unique(data['RecurringRule'])
    revisions = unique(data['RecurringRuleRevision'])
    pauses = unique(data['RecurringPausePeriod'])
    ledger = unique(data['RecurringOccurrenceLedger'])
    receipts = unique(data['WriteReceipt'], 'operationToken')
    for name, rows in data.items():
        key = 'operationToken' if name == 'WriteReceipt' else 'id'
        if name != 'PreferencesPortable':
            require([r[key] for r in rows] == sorted(r[key] for r in rows), 'Noncanonical table order')
        for row in rows:
            if 'updatedAtUtc' in row:
                require(row['updatedAtUtc'] >= row['createdAtUtc'], 'Reversed timestamps')
    def check_date(value, cursor=False):
        require(day('1900-01-01' if cursor else '1900-01-02') <= day(value) <= day('9999-12-30'), 'Date range')
    def zone(value):
        try:
            return ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise Failure('Timezone unavailable in oracle runtime: ' + value)
    def payload(value):
        require(value['accountId'] in accounts and value['categoryId'] in cats, 'Payload target absent')
        require(cats[value['categoryId']]['type'] == value['type'], 'Payload category type mismatch')
        check_date(value['startDate'])
        if value['endDate'] is not None:
            check_date(value['endDate'])
            require(value['endDate'] >= value['startDate'], 'Payload date bounds')
        zone(value['schedulingTimeZoneId'])
    by_rule = {key: [] for key in rules}
    for revision in revisions.values():
        require(revision['ruleId'] in rules, 'Revision rule absent')
        rule = rules[revision['ruleId']]
        payload(revision['payload'])
        check_date(revision['effectiveFromDate'])
        require(revision['payload']['schedulingTimeZoneId'] == rule['schedulingTimeZoneId'], 'Rule timezone changed')
        require(revision['payload']['startDate'] >= rule['initialStartDate'], 'Revision moves initial start backwards')
        if revision['revisionSequence'] > 1:
            tomorrow = instant(revision['createdAtUtc']).astimezone(zone(rule['schedulingTimeZoneId'])).date() + dt.timedelta(days=1)
            require(revision['effectiveFromDate'] == max(tomorrow, day(rule['initialStartDate'])).isoformat(), 'Nonprospective edit boundary')
        by_rule[revision['ruleId']].append(revision)
    for rule in rules.values():
        check_date(rule['initialStartDate'])
        check_date(rule['evaluatedThroughDate'], cursor=True)
        zone(rule['schedulingTimeZoneId'])
        ordered = sorted(by_rule[rule['id']], key=lambda r: r['revisionSequence'])
        require([r['revisionSequence'] for r in ordered] == list(range(1, len(ordered) + 1)) and bool(ordered), 'Revision sequence gap')
        require(ordered[0]['effectiveFromDate'] == rule['initialStartDate'], 'Initial revision boundary')
        require([r['effectiveFromDate'] for r in ordered] == sorted(r['effectiveFromDate'] for r in ordered), 'Nonmonotone revision dates')
        require(day(rule['evaluatedThroughDate']) >= day(rule['initialStartDate']) - dt.timedelta(days=1), 'Cursor before initialization')
    def winner(rule_id, date):
        candidates = [r for r in by_rule[rule_id] if r['effectiveFromDate'] <= date]
        require(bool(candidates), 'No effective revision')
        return max(candidates, key=lambda r: (r['effectiveFromDate'], r['revisionSequence']))
    def eligible(value, date):
        return value['startDate'] <= date and (value['endDate'] is None or date <= value['endDate']) and bool(value['weekdayMask'] & (1 << day(date).weekday()))
    periods = {key: [] for key in rules}
    for pause in pauses.values():
        require(pause['ruleId'] in rules, 'Pause rule absent')
        check_date(pause['firstExcludedDate'])
        if pause['firstIncludedDate'] is not None:
            check_date(pause['firstIncludedDate'])
            require(pause['firstIncludedDate'] >= pause['firstExcludedDate'], 'Reversed pause')
        periods[pause['ruleId']].append(pause)
    for rule_id, items in periods.items():
        open_count = sum(p['firstIncludedDate'] is None for p in items)
        require(open_count <= 1 and rules[rule_id]['isPaused'] == (open_count == 1), 'Pause flag mismatch')
        nonempty = sorted((p for p in items if p['firstIncludedDate'] != p['firstExcludedDate']), key=lambda p: p['firstExcludedDate'])
        for a, b in zip(nonempty, nonempty[1:]):
            require(a['firstIncludedDate'] is not None and a['firstIncludedDate'] <= b['firstExcludedDate'], 'Overlapping pause periods')
    refund_sums = {}
    tokens = set()
    origin_ids = set()
    for transaction in transactions.values():
        t = transaction
        check_date(t['accountingDate'])
        zone(t['createdTimeZoneId'])
        require(t['accountId'] in accounts, 'Transaction account absent')
        require(t['idempotencyToken'] not in tokens, 'Duplicate transaction token')
        tokens.add(t['idempotencyToken'])
        receipt = receipts.get(t['idempotencyToken'])
        require(receipt is not None and receipt['entityType'] == 'transaction' and receipt['entityId'] == t['id'] and receipt['operation'] in ('create','confirm'), 'Missing create/confirm receipt')
        if t['type'] == 'transfer':
            require(t['toAccountId'] in accounts and t['toAccountId'] != t['accountId'], 'Invalid transfer accounts')
            require(t['categoryId'] is None and t['expenseEffect'] is None and t['refundOfTransactionId'] is None and t['originKind'] == 'manual', 'Transfer field combination')
        else:
            require(t['categoryId'] in cats and cats[t['categoryId']]['type'] == t['type'], 'Transaction category mismatch')
            require(t['toAccountId'] is None, 'Unexpected transfer destination')
            if t['type'] == 'income':
                require(t['expenseEffect'] is None and t['refundOfTransactionId'] is None, 'Income effect/link')
            elif t['expenseEffect'] == 'purchase':
                require(t['refundOfTransactionId'] is None, 'Purchase refund link')
            else:
                require(t['expenseEffect'] == 'refund' and t['originKind'] == 'manual', 'Refund kind')
                original = transactions.get(t['refundOfTransactionId'])
                require(original is not None and original['type'] == 'expense' and original['expenseEffect'] == 'purchase', 'Refund original absent/ineligible')
                require(original['categoryId'] == t['categoryId'], 'Refund category mismatch')
                refund_sums[original['id']] = refund_sums.get(original['id'], 0) + t['amountMinor']
        fields = ['originOccurrenceId','originRuleTitleSnapshot','originScheduleSnapshot','originOccurrenceDate']
        if t['originKind'] == 'manual':
            require(all(t[key] is None for key in fields), 'Manual origin snapshot/link')
        else:
            require(all(t[key] is not None for key in fields), 'Recurring origin field missing')
            require(t['originOccurrenceId'] not in origin_ids, 'Duplicate transaction occurrence')
            origin_ids.add(t['originOccurrenceId'])
            occurrence = ledger.get(t['originOccurrenceId'])
            require(occurrence is not None and occurrence['disposition'] == 'confirmed' and occurrence['transactionId'] == t['id'], 'Nonreciprocal origin')
            require(t['originRuleTitleSnapshot'] == occurrence['payloadSnapshot']['title'] and t['originScheduleSnapshot'] == occurrence['payloadSnapshot'] and t['originOccurrenceDate'] == occurrence['occurrenceDate'], 'Origin snapshot mismatch')
    for original, total in refund_sums.items():
        require(total <= transactions[original]['amountMinor'], 'Over-refund')
    budget_keys = set()
    for budget in budgets.values():
        key = (budget['categoryId'], budget['month'])
        require(key not in budget_keys, 'Duplicate Budget month')
        budget_keys.add(key)
        require(budget['categoryId'] in cats and cats[budget['categoryId']]['type'] == 'expense', 'Budget category mismatch')
        check_date(budget['month'] + '-02')
    occurrence_keys = set()
    for occurrence in ledger.values():
        o = occurrence
        require(o['ruleId'] in rules and o['ruleRevisionId'] in revisions, 'Occurrence rule/revision absent')
        check_date(o['occurrenceDate'])
        key = (o['ruleId'], o['occurrenceDate'])
        require(key not in occurrence_keys, 'Duplicate occurrence key')
        occurrence_keys.add(key)
        revision = winner(o['ruleId'], o['occurrenceDate'])
        require(revision['id'] == o['ruleRevisionId'], 'Incorrect winning revision')
        require(o['payloadSnapshot'] == revision['payload'] and eligible(revision['payload'], o['occurrenceDate']), 'Snapshot/eligibility mismatch')
        require(o['occurrenceDate'] <= rules[o['ruleId']]['evaluatedThroughDate'], 'Occurrence beyond cursor')
        pending = o['disposition'] in ('pending','deferred_backlog')
        require((o['resolvedAtUtc'] is None) == pending, 'Resolved timestamp mismatch')
        if pending:
            require(rules[o['ruleId']]['deletedAtUtc'] is None, 'Tombstone has pending history')
            require(not accounts[o['payloadSnapshot']['accountId']]['isArchived'] and not cats[o['payloadSnapshot']['categoryId']]['isArchived'], 'Archived pending target')
        if o['disposition'] == 'confirmed':
            require(o['transactionId'] in transactions and transactions[o['transactionId']]['originOccurrenceId'] == o['id'], 'Confirmed link absent/nonreciprocal')
        else:
            require(o['transactionId'] is None, 'Nonconfirmed transaction link')
        if o['disposition'] == 'cancelled_rule_deleted':
            require(rules[o['ruleId']]['deletedAtUtc'] is not None, 'Live rule cancellation')
        if o['disposition'] in ('deferred_backlog','excluded_user','excluded_pause'):
            require(o['amountOverrideMinor'] is None, 'Impossible override state')
        if o['disposition'] == 'excluded_pause':
            require(any(p['firstExcludedDate'] <= o['occurrenceDate'] and (p['firstIncludedDate'] is None or o['occurrenceDate'] < p['firstIncludedDate']) for p in periods[o['ruleId']]), 'Pause exclusion without interval')
    for rule in rules.values():
        date = day(rule['initialStartDate'])
        through = day(rule['evaluatedThroughDate'])
        while date <= through:
            value = date.isoformat()
            if eligible(winner(rule['id'], value)['payload'], value):
                require((rule['id'], value) in occurrence_keys, 'Cursor skips eligible occurrence')
            date += dt.timedelta(days=1)

def classify(raw):
    try:
        if raw.startswith(b'\xef\xbb\xbf'):
            return 'MALFORMED_BACKUP'
        package = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                             parse_float=no_float, parse_constant=no_float)
        canonical(package)  # rejects unpaired surrogate strings during UTF-8 encoding
    except (ValueError, UnicodeError):
        return 'MALFORMED_BACKUP'
    if not isinstance(package, dict):
        return 'MALFORMED_BACKUP'
    version = package.get('backupSchemaVersion')
    if type(version) is not int or version <= 0:
        return 'MALFORMED_BACKUP'
    if version <= 5:
        return 'UNSUPPORTED_LEGACY_SCHEMA'
    if version > 6:
        return 'BACKUP_FROM_NEWER_APP'
    if list(VALIDATOR.iter_errors(package)):
        return 'SCHEMA_INVALID'
    for name, rows in package['data'].items():
        entry = package['manifest'][name]
        if entry['count'] != len(rows) or entry['sha256'] != sha(rows):
            return 'HASH_MISMATCH'
    if package['dataSha256'] != sha(package['data']):
        return 'HASH_MISMATCH'
    try:
        semantic(package['data'])
    except Failure as exc:
        return 'INVARIANT_VIOLATION', str(exc)
    return 'ACCEPT'

def main():
    Draft202012Validator.check_schema(SCHEMA)
    cases = json.loads((FIXTURES / 'cases.json').read_text(encoding='utf-8'))['cases']
    pins = json.loads((FIXTURES / 'file-sha256.json').read_text(encoding='utf-8'))
    for name, expected in pins.items():
        require(hashlib.sha256((FIXTURES / name).read_bytes()).hexdigest() == expected, 'Fixture bytes changed: ' + name)
    errors = []
    results = []
    for case in cases:
        result = classify((FIXTURES / case['file']).read_bytes())
        actual = result[0] if isinstance(result, tuple) else result
        passed = actual == case['expected']
        results.append({'id':case['id'],'expected':case['expected'],'actual':actual,'passed':passed})
        if not passed:
            errors.append((case['id'],case['file'],case['expected'],result))
    # Independent numerical expectations, not application execution.
    gold = json.loads((FIXTURES / 'golden-history.json').read_text(encoding='utf-8'))['data']
    balance = {a['id']:a['openingBalanceMinor'] for a in gold['Account']}
    expenses = {}
    for t in gold['Transaction']:
        effect = 1 if t['type']=='income' or t['expenseEffect']=='refund' else -1
        balance[t['accountId']] += effect*t['amountMinor']
        if t['type']=='expense':
            month=t['accountingDate'][:7]
            expenses[month]=expenses.get(month,0)+(-t['amountMinor'] if t['expenseEffect']=='refund' else t['amountMinor'])
    require(sorted(balance.values()) == [-12000,-500], 'Golden balances differ from oracle')
    require(expenses == {'2026-09':10000,'2026-10':2000}, 'Golden month net expenses differ')
    summary={'fixtureCount':len(cases),'passed':len(cases)-len(errors),'failed':len(errors),'results':results,
             'goldenAccountBalancesMinor':balance,'goldenNetExpenseByMonthMinor':expenses,
             'scope':'Documentation fixture/schema oracle only; no app/device tests executed.'}
    print(json.dumps(summary,indent=2))
    if errors:
        raise AssertionError(errors)

if __name__ == '__main__':
    main()
