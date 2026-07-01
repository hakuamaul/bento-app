export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};
export const Alert = { alert: () => {} };
