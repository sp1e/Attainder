// The picture of a medallion: a portrait image, a crop of a portrait atlas, or initials. What to show is decided by
// `medallionOf` (src/Game/Map/seatRulers.js); the court's thread and the seats on the map both draw it.
import React from "react";

const PICTURE_STYLE = { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" };

export default function MedallionPicture({ medallion }) {
  if (medallion.kind === "image") return <img src={medallion.src} alt="" aria-hidden="true" style={PICTURE_STYLE} />;
  if (medallion.kind === "atlas") {
    const { rect } = medallion;
    return (
      <svg viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`} preserveAspectRatio="xMidYMin slice" focusable="false" aria-hidden="true" style={PICTURE_STYLE}>
        <image href={medallion.src} width={medallion.width} height={medallion.height} />
      </svg>
    );
  }
  return <span aria-hidden="true">{medallion.text}</span>;
}
