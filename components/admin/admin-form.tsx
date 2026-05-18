"use client";

/**
 * 管理员新建 / 编辑共用表单组件。
 * 复用 react-hook-form + zod（项目已有依赖），不新增包。
 */

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ASSIGNABLE_MENUS } from "@/lib/menus";
import { isValidCnMobile } from "@/lib/phone";
import { withBase } from "@/lib/url";

// ---- schema ----
const baseSchema = z.object({
  username: z
    .string()
    .refine(isValidCnMobile, { message: "用户名需为 11 位大陆手机号" }),
  name: z.string().min(1, "姓名不能为空"),
  note: z.string().optional(),
  menus: z.array(z.string()),
});

const createSchema = baseSchema.extend({
  password: z.string().min(8, "密码至少 8 位"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "两次密码不一致",
  path: ["confirmPassword"],
});

const editSchema = baseSchema.extend({
  // 编辑时密码留空 = 不改
  password: z.string().optional().refine(
    (v) => !v || v.length >= 8,
    { message: "密码至少 8 位" }
  ),
  confirmPassword: z.string().optional(),
  is_active: z.boolean(),
}).refine(
  (d) => !d.password || d.password === d.confirmPassword,
  { message: "两次密码不一致", path: ["confirmPassword"] }
);

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

// ---- props ----
interface CreateProps {
  mode: "create";
}
interface EditProps {
  mode: "edit";
  adminId: number;
  isSelf: boolean; // 超管编辑自己时隐藏 is_active 开关
  defaultValues: Partial<EditValues>;
}
type AdminFormProps = CreateProps | EditProps;

export function AdminForm(props: AdminFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = props.mode === "edit";

  // 根据模式选 schema
  const schema = isEdit ? editSchema : createSchema;
  type FormValues = typeof isEdit extends true ? EditValues : CreateValues;

  const defaultVals =
    isEdit
      ? {
          username: "",
          name: "",
          note: "",
          menus: [],
          password: "",
          confirmPassword: "",
          is_active: true,
          ...(props as EditProps).defaultValues,
        }
      : { username: "", name: "", note: "", menus: [], password: "", confirmPassword: "" };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: defaultVals as FormValues,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMenus: string[] = watch("menus" as any) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isActive: boolean = isEdit ? (watch("is_active" as any) ?? true) : true;

  function toggleMenu(key: string) {
    const next = selectedMenus.includes(key)
      ? selectedMenus.filter((k) => k !== key)
      : [...selectedMenus, key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setValue("menus" as any, next, { shouldValidate: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onSubmit(data: any) {
    setServerError(null);
    const url = isEdit
      ? withBase(`/api/admin/admins/${(props as EditProps).adminId}`)
      : withBase("/api/admin/admins");
    const method = isEdit ? "PATCH" : "POST";

    const payload: Record<string, unknown> = {
      name: data.name,
      note: data.note || undefined,
      menus: data.menus,
    };
    if (!isEdit) {
      payload.username = data.username;
      payload.password = data.password;
    }
    if (isEdit) {
      if (data.password) payload.password = data.password;
      if (!(props as EditProps).isSelf) {
        payload.is_active = data.is_active;
      }
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setServerError(json.error ?? "操作失败");
      return;
    }
    router.push("/admin/admins");
    router.refresh();
  }

  const isSelf = isEdit && (props as EditProps).isSelf;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {/* 用户名（数据层仍存大陆手机号，UI 改名「用户名」） */}
      <div className="space-y-1.5">
        <Label htmlFor="username">用户名</Label>
        {isEdit ? (
          <Input
            id="username"
            value={(props as EditProps).defaultValues.username ?? ""}
            readOnly
            disabled
            className="bg-gray-50 text-gray-500"
            style={{ fontSize: "16px" }}
          />
        ) : (
          <>
            <Input
              id="username"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="请输入 11 位手机号作为用户名"
              {...register("username" as never)}
              style={{ fontSize: "16px" }}
            />
            {errors.username && (
              <p className="text-xs text-red-600">{errors.username.message as string}</p>
            )}
          </>
        )}
      </div>

      {/* 姓名 */}
      <div className="space-y-1.5">
        <Label htmlFor="name">姓名</Label>
        <Input
          id="name"
          placeholder="如：张三"
          {...register("name" as never)}
          style={{ fontSize: "16px" }}
        />
        {errors.name && (
          <p className="text-xs text-red-600">{errors.name.message as string}</p>
        )}
      </div>

      {/* 备注 */}
      <div className="space-y-1.5">
        <Label htmlFor="note">备注（选填）</Label>
        <Textarea
          id="note"
          placeholder="如：负责职业定位项目"
          rows={2}
          {...register("note" as never)}
          className="resize-none"
        />
      </div>

      {/* 菜单权限 */}
      <div className="space-y-2">
        <Label>菜单权限</Label>
        <p className="text-[11px] text-gray-400">
          每个勾选项独立控制对应菜单的可见性，互不联动。
        </p>
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          {ASSIGNABLE_MENUS.map((m) => {
            const checked = selectedMenus.includes(m.key);
            return (
              <label
                key={m.key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMenu(m.key)}
                  className="mt-0.5 size-4 rounded border-gray-300 accent-blue-600"
                />
                <div className="leading-tight">
                  <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                    {m.label}
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{m.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 密码 */}
      <div className="space-y-1.5">
        <Label htmlFor="password">
          {isEdit ? "新密码（留空则不修改）" : "密码"}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={isEdit ? "留空不修改" : "至少 8 位"}
          {...register("password" as never)}
          style={{ fontSize: "16px" }}
        />
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password.message as string}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">确认密码</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={isEdit ? "留空不修改" : "再输一次"}
          {...register("confirmPassword" as never)}
          style={{ fontSize: "16px" }}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-600">{errors.confirmPassword.message as string}</p>
        )}
      </div>

      {/* 账号状态（编辑时显示，自编辑时隐藏） */}
      {isEdit && !isSelf && (
        <div className="space-y-1.5">
          <Label>账号状态</Label>
          <div className="flex gap-2">
            <label
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-all border ${
                isActive
                  ? "ring-2 ring-emerald-500 bg-emerald-50 text-emerald-800 border-transparent"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="is_active"
                checked={isActive}
                onChange={() =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  setValue("is_active" as any, true, { shouldValidate: true })
                }
                className="sr-only"
              />
              启用
            </label>
            <label
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-all border ${
                !isActive
                  ? "ring-2 ring-amber-500 bg-amber-50 text-amber-800 border-transparent"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="is_active"
                checked={!isActive}
                onChange={() =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  setValue("is_active" as any, false, { shouldValidate: true })
                }
                className="sr-only"
              />
              停用
            </label>
          </div>
          {!isActive && (
            <p className="text-[11px] text-amber-600">
              停用后该管理员将无法登录，已登录的 session 也会立即失效。
            </p>
          )}
        </div>
      )}

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          取消
        </Button>
        <Button
          type="submit"
          className="btn-primary-glow text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? "保存中…" : "保存"}
        </Button>
      </div>
    </form>
  );
}
