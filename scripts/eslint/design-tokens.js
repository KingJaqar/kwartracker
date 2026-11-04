const styleKeys = /^(?:color|backgroundColor|border(?:Top|Bottom|Left|Right)?Color|tintColor|shadowColor|fill|stroke|padding(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|margin(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|gap|rowGap|columnGap|border(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius|fontSize|lineHeight|fontWeight|fontFamily|letterSpacing|duration|damping|stiffness|strokeWidth|size)$/;
const color = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;
module.exports = {
  meta: { type: 'problem', schema: [], messages: { literal: 'Use the shared design tokens for {{key}}.', color: 'Colors must come from src/theme/tokens.ts.', barrel: 'Import Lucide icons individually from lucide-react-native/icons/<name>.' } },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && color.test(node.value)) context.report({ node, messageId: 'color' });
      },
      Property(node) {
        const key = node.key.name ?? node.key.value;
        if (styleKeys.test(key) && (node.value.type === 'Literal' || (node.value.type === 'UnaryExpression' && node.value.argument.type === 'Literal'))) {
          context.report({ node: node.value, messageId: 'literal', data: { key } });
        }
      },
      JSXAttribute(node) {
        const key = node.name.name;
        const value = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        if (styleKeys.test(key) && value?.type === 'Literal') context.report({ node: value, messageId: 'literal', data: { key } });
      },
      ImportDeclaration(node) {
        if (node.source.value === 'lucide-react-native' && node.importKind !== 'type') context.report({ node, messageId: 'barrel' });
      },
    };
  },
};
