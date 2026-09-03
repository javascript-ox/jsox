function componentExpression(tag) {
  return /^[A-Z_$]/.test(tag) ? tag : JSON.stringify(tag);
}

export default {
  namespaceHandlers: {
    react: {
      tags: ["article", "button", "div", "h2", "p", "CounterCard", "Box", "Button", "Card", "CardContent", "Chip", "LinearProgress", "Stack", "Typography", "ReleaseDashboard"],
      types: {
        target: "ReactNodeBuilder",
        result: "React.ReactElement",
      },
      create(tag) {
        return `new ReactNodeBuilder(${componentExpression(tag)})`;
      },
      finalize(target) {
        return `finalizeReactNode(${target})`;
      },
    },
    vue: {
      tags: ["article", "button", "div", "h2", "p", "VueCounter", "Button", "Card", "ProgressBar", "Tag", "DeploymentPanel"],
      types: {
        target: "VueNodeBuilder",
        result: 'import("vue").VNode',
      },
      create(tag) {
        return `new VueNodeBuilder(${componentExpression(tag)})`;
      },
      finalize(target) {
        return `finalizeVueNode(${target})`;
      },
    },
    test: {
      create(tag) {
        return '';
      }
    }
  },
};
