export const routes = new Map([
  ["/", "jsox-home-page"],
  ["/start", "jsox-start-page"],
  ["/tutorial", "jsox-tutorial-page"],
  ["/hello", "jsox-hello-page"],
  ["/counter", "jsox-counter-page"],
  ["/effect", "jsox-effect-page"],
  ["/todo", "jsox-todo-page"],
  ["/pojo", "jsox-pojo-page"],
  ["/rxjs", "jsox-rxjs-page"],
  ["/web-components", "jsox-web-components-page"],
]);

export function currentPath(hash = location.hash) {
  const path = hash.replace(/^#/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveRoute(path) {
  return routes.get(path) ?? "jsox-missing-page";
}
