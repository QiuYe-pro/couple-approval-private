export const metadata = {
  title: "我们的小申请系统",
  description: "公网只读，登录可写"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

