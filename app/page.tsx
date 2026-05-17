import { redirect } from "next/navigation";

export default function RootPage() {
  // next/navigation 的 redirect() 在 server component 里**会自动加 basePath**。
  // 这里写 "/admin/login"，运行时实际跳到 "/b100/admin/login"。
  redirect("/admin/login");
}
