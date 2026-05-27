import { redirect } from "next/navigation";

export default function RootPage() {
  // next/navigation 的 redirect() 在 server component 里**会自动加 basePath**。
  // 这里写 "/admin/home"，运行时实际跳到 "/b100/admin/home"。
  // 未登录用户会被 proxy.ts 拦下并 redirect 回 /admin/login。
  redirect("/admin/home");
}
