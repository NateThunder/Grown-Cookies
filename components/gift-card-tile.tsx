import styles from "./gift-card-tile.module.css";

type GiftCardTileProps = {
  className?: string;
};

export default function GiftCardTile({ className = "" }: GiftCardTileProps) {
  const tileClassName = [styles.tile, className].filter(Boolean).join(" ");

  return (
    <div className={tileClassName}>
      <span className={styles.brand}>grown</span>
      <span className={styles.brand}>cookies</span>
      <span className={styles.text}>GIFT CARD</span>
    </div>
  );
}
