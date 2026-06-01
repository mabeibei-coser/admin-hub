/**
 * 菜单权限元数据。
 * 菜单和权限 1:1 直连：menus_json 存什么 key，老师就能看哪个菜单。
 * 不引入 wildcard，不自动联动。
 *
 * 两个来源：
 *   1) PROJECT_LIST 派生 → 每个项目自动一个菜单 key（report/nav/...）
 *   2) EXTRA_MENUS 手动添加 → 非项目类菜单（如 service 服务跟踪、courseware-users 课件用户）
 */

import { PROJECT_LIST, type ProjectId } from "./projects";

/** 非项目类菜单 key。新增独立菜单在这里追加。 */
export type ExtraMenuKey = "service" | "courseware-users" | "asg-members" | "asg-documents";

/** menus_json 里能存的所有 key 类型。"admins" 由 is_super 派生，不存这里。 */
export type StoredMenuKey = "all" | ProjectId | ExtraMenuKey;

/** sidebar 实际展示菜单 key。"admins" 由 is_super 派生。 */
export type MenuKey = StoredMenuKey | "admins";

/**
 * 非项目类菜单（独立常量，不跟 PROJECT_LIST 联动）。
 * 新增独立菜单（如服务跟踪、统计看板）在这里加一项。
 */
export const EXTRA_MENUS: ReadonlyArray<{
  key: ExtraMenuKey;
  label: string;
  description: string;
}> = [
  {
    key: "service",
    label: "服务跟踪",
    description: "咨询服务持续跟进记录",
  },
  {
    key: "courseware-users",
    label: "课件用户",
    description: "智能课件白名单用户",
  },
  {
    key: "asg-members",
    label: "安防平台用户",
    description: "安全隐患域 VIP 会员与收款",
  },
  {
    key: "asg-documents",
    label: "文档资料",
    description: "安防文档库内容管理",
  },
];

/**
 * 管理员表单可分配的权限选项（互不联动）。
 * "admins" 不在此列表——超管身份由 is_super 字段单独控制。
 */
export const ASSIGNABLE_MENUS: ReadonlyArray<{
  key: StoredMenuKey;
  label: string;
  description: string;
}> = [
  { key: "all", label: "全部", description: "两个项目合计的聚合视图" },
  ...PROJECT_LIST.map((p) => ({
    key: p.id as StoredMenuKey,
    label: p.label,
    description: p.description ?? p.label,
  })),
  ...EXTRA_MENUS,
];

/** 极简 1:1 包含判断：超管自动 true；否则看 menus 数组是否包含该 key。 */
export function canViewMenu(
  s: { isSuper?: boolean; menus?: Array<StoredMenuKey> },
  menu: StoredMenuKey
): boolean {
  if (s.isSuper) return true;
  return s.menus?.includes(menu) ?? false;
}

/**
 * 派生当前 session 能看哪些菜单。
 * sidebar 用这个结果决定哪些 nav item 可见。
 */
export function deriveVisibleMenus(s: {
  isSuper?: boolean;
  menus?: Array<StoredMenuKey>;
}): {
  showAll: boolean;
  visibleProjects: ProjectId[];
  showService: boolean;
  showCoursewareUsers: boolean;
  showAsgMembers: boolean;
  showAsgDocuments: boolean;
  showAdmins: boolean;
} {
  return {
    showAll: canViewMenu(s, "all"),
    visibleProjects: PROJECT_LIST.filter((p) => canViewMenu(s, p.id)).map(
      (p) => p.id
    ),
    showService: canViewMenu(s, "service"),
    showCoursewareUsers: canViewMenu(s, "courseware-users"),
    showAsgMembers: canViewMenu(s, "asg-members"),
    showAsgDocuments: canViewMenu(s, "asg-documents"),
    showAdmins: !!s.isSuper,
  };
}
