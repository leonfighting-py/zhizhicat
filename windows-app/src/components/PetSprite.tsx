import type { PointerEventHandler, MouseEventHandler } from "react";

import { ANIMATIONS, type AnimationName } from "../pet/animations";
import { spriteStyle } from "../pet/spriteStyle";
import type { SizeScale } from "../settings/settings";

interface PetSpriteProps {
  action: AnimationName;
  frame: number;
  sizeScale: SizeScale;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}

export function PetSprite({
  action,
  frame,
  sizeScale,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
}: PetSpriteProps) {
  const animation = ANIMATIONS[action];

  return (
    <div
      aria-label="之之"
      className="pet-sprite"
      data-action={action}
      data-testid="pet-sprite"
      draggable={false}
      onContextMenu={onContextMenu}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="img"
      style={spriteStyle(frame, animation.row, sizeScale)}
    />
  );
}
