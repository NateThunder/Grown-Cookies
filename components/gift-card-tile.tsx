import Image from "next/image";
import styles from "./gift-card-tile.module.css";

type GiftCardTileProps = {
  alt?: string;
  className?: string;
  preload?: boolean;
  src?: string;
};

export default function GiftCardTile({
  alt = "Grown Cookies gift card",
  className = "",
  preload = false,
  src = "/growncookies-1024-transparent.png",
}: GiftCardTileProps) {
  const tileClassName = [styles.tile, className].filter(Boolean).join(" ");

  return (
    <div className={tileClassName}>
      <Image
        src={src}
        alt={alt}
        fill
        preload={preload}
        sizes="(max-width: 768px) 100vw, 50vw"
        className={styles.image}
      />
    </div>
  );
}
