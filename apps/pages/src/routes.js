export const routes = new Map([
  ["/", () => import("./pages/home.jsox").then(({ Home }) => Home())],
  ["/start", () => import("./pages/docs.jsox").then(({ QuickStart }) => QuickStart())],
  ["/tutorial", () => import("./pages/docs.jsox").then(({ Tutorial }) => Tutorial())],
  ["/hello", () => import("@js-ox/hello").then(({ Hello }) => Hello())],
  ["/counter", () => import("@js-ox/counter").then(({ Counter }) => Counter())],
  ["/d3", () => import("@js-ox/d3").then(({ D3Example }) => D3Example())],
  ["/effect", () => import("@js-ox/effect").then(({ EffectExample }) => EffectExample())],
  ["/gsap", () => import("@js-ox/gsap").then(({ GsapExample }) => GsapExample())],
  ["/htmx", () => import("@js-ox/htmx").then(({ HtmxExample }) => HtmxExample())],
  ["/todo", () => import("@js-ox/todo").then(({ Todo }) => Todo())],
  ["/pojo", () => import("@js-ox/pojo").then(({ Pojo }) => Pojo())],
  ["/rxjs", () => import("@js-ox/rxjs").then(({ Rxjs }) => Rxjs())],
  ["/stimulus", () => import("@js-ox/stimulus").then(({ StimulusExample }) => StimulusExample())],
  ["/three", () => import("@js-ox/three").then(({ ThreeExample }) => ThreeExample())],
  ["/web-components", () => import("@js-ox/web-components-example").then(({ WebComponents }) => WebComponents())],
  ["/xstate", () => import("@js-ox/xstate").then(({ XStateExample }) => XStateExample())],
  ["/zod", () => import("@js-ox/zod").then(({ ZodExample }) => ZodExample())],
]);

const notFound = () => import("./pages/not-found.jsox").then(({ NotFound }) => NotFound());

export function currentPath(hash = location.hash) {
  const path = hash.replace(/^#/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveRoute(path) {
  return routes.get(path) ?? notFound;
}
