export default [
  {
    path: "/login",
    layout: false,
    component: "./login",
  },
  {
    path: "/",
    component: "./editor",
  },
  {
    path: "*",
    redirect: "/",
  },
];
