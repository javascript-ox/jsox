export const routes = new Map([
  ["/", () => import("./pages/home.jsox").then(({ Home }) => Home())],
  ["/alpine", () => import("@js-ox/alpine").then(({ AlpineExample }) => AlpineExample())],
  ["/start", () => import("./pages/docs.jsox").then(({ QuickStart }) => QuickStart())],
  ["/tutorial", () => import("./pages/docs.jsox").then(({ Tutorial }) => Tutorial())],
  ["/hello", () => import("@js-ox/hello").then(({ Hello }) => Hello())],
  ["/counter", () => import("@js-ox/counter").then(({ Counter }) => Counter())],
  ["/chartjs", () => import("@js-ox/chartjs").then(({ ChartJsExample }) => ChartJsExample())],
  ["/d3", () => import("@js-ox/d3").then(({ D3Example }) => D3Example())],
  ["/effect", () => import("@js-ox/effect").then(({ EffectExample }) => EffectExample())],
  ["/gsap", () => import("@js-ox/gsap").then(({ GsapExample }) => GsapExample())],
  ["/htmx", () => import("@js-ox/htmx").then(({ HtmxExample }) => HtmxExample())],
  ["/mobx", () => import("@js-ox/mobx").then(({ MobxExample }) => MobxExample())],
  ["/material-ui", () => import("@js-ox/material-ui").then(({ MaterialUiExample }) => MaterialUiExample())],
  ["/primevue", () => import("@js-ox/primevue").then(({ PrimeVueExample }) => PrimeVueExample())],
  ["/todo", () => import("@js-ox/todo").then(({ Todo }) => Todo())],
  ["/pojo", () => import("@js-ox/pojo").then(({ Pojo }) => Pojo())],
  ["/react", () => import("@js-ox/react-example").then(({ ReactExample }) => ReactExample())],
  ["/rxjs", () => import("@js-ox/rxjs").then(({ Rxjs }) => Rxjs())],
  ["/shadcn", () => import("@js-ox/shadcn").then(({ ShadcnExample }) => ShadcnExample())],
  ["/solid", () => import("@js-ox/solid").then(({ SolidExample }) => SolidExample())],
  ["/sortable", () => import("@js-ox/sortable").then(({ SortableExample }) => SortableExample())],
  ["/stimulus", () => import("@js-ox/stimulus").then(({ StimulusExample }) => StimulusExample())],
  ["/three", () => import("@js-ox/three").then(({ ThreeExample }) => ThreeExample())],
  ["/svelte", () => import("@js-ox/svelte").then(({ SvelteExample }) => SvelteExample())],
  ["/tanstack", () => import("@js-ox/tanstack-query").then(({ TanStackExample }) => TanStackExample())],
  ["/tanstack-table", () => import("@js-ox/tanstack-table").then(({ TanStackTableExample }) => TanStackTableExample())],
  ["/web-components", () => import("@js-ox/web-components-example").then(({ WebComponents }) => WebComponents())],
  ["/vue", () => import("@js-ox/vue-example").then(({ VueExample }) => VueExample())],
  ["/lit", () => import("@js-ox/lit").then(({ LitExample }) => LitExample())],
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
