import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "xl" | "2xl" | "full";
};

export default function PageContainer({ children, className = "", maxWidth = "2xl" }: Props) {
  const max =
    maxWidth === "full"
      ? "max-w-none"
      : maxWidth === "2xl"
      ? "max-w-screen-2xl"
      : "max-w-screen-1xl";

  return (
    <div className={"mx-auto w-full px-2 sm:px-4 " + max + " " + className}>
      {children}
    </div>
  );
}
