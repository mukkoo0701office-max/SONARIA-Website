"use client";

type Props = {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

// 選択チップ。選択状態は色だけでなく aria-pressed でも伝える
export default function Chip({ pressed, onClick, children }: Props) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "rounded-full border border-navy bg-navy px-[13px] py-[9px] text-[13px] text-white transition-[filter] hover:brightness-95"
          : "rounded-full border border-line bg-card px-[13px] py-[9px] text-[13px] text-ink transition-[filter] hover:brightness-95"
      }
    >
      {children}
    </button>
  );
}
