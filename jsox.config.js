function componentExpression(tag) {
  return /^[A-Z_$]/.test(tag) ? tag : JSON.stringify(tag);
}

export default {
  namespaceHandlers: {
    react: {
      create(tag) {
        return `new ReactNodeBuilder(${componentExpression(tag)})`;
      },
      finalize(target) {
        return `finalizeReactNode(${target})`;
      },
    },
    vue: {
      create(tag) {
        return `new VueNodeBuilder(${componentExpression(tag)})`;
      },
      finalize(target) {
        return `finalizeVueNode(${target})`;
      },
    },
  },
};
