"""
Génère les déclinaisons web du logo officiel à partir des fichiers fournis (docs/brand-sources),
sans modifier le dessin : seuls le fond (blanc ou cartouche bordeaux) est rendu transparent,
les marges vides retirées et la taille adaptée (rééchantillonnage Lanczos, PNG sans perte).

  python3 scripts/brand/generate_brand_assets.py

Sorties (public/brand) :
  tb-logo.png             logo complet (avec slogan), pour fonds clairs
  tb-logo-inverse.png     logo complet issu du cartouche bordeaux, pour fonds sombres
  tb-wordmark.png         « Talent Bridge » + pont, sans slogan, pour fonds clairs (petites tailles)
  tb-wordmark-inverse.png idem pour fonds sombres
  tb-pictogramme.png      pont seul (filigrane des certificats, barre latérale repliée)
  apple-touch-icon.png et src/app/icon.png : icônes carrées issues du pictogramme
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "brand-sources"
OUT = ROOT / "public" / "brand"


def remove_background(rgb: np.ndarray, bg: tuple[int, int, int], full: float = 110.0) -> np.ndarray:
    """Fond uni -> transparent. Alpha selon la distance à la couleur du fond, puis dé-mélange
    des pixels de bord pour retirer le liseré coloré (pas de halo)."""
    c = np.array(bg, dtype=np.float64)
    p = rgb.astype(np.float64)
    d = np.sqrt(((p - c) ** 2).sum(axis=2))
    alpha = np.clip((d - 12.0) / (full - 12.0), 0.0, 1.0)
    a = alpha[..., None]
    safe = np.where(a > 0.004, a, 1.0)
    fg = np.clip((p - (1.0 - a) * c) / safe, 0, 255)
    return np.dstack([fg, alpha * 255.0]).astype(np.uint8)


def trim(rgba: np.ndarray, pad: int = 6) -> np.ndarray:
    m = rgba[..., 3] > 8
    ys, xs = np.where(m)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


def save(rgba: np.ndarray, name: str, width: int) -> None:
    img = Image.fromarray(rgba, "RGBA")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(OUT / name, optimize=True)
    print(f"{name}: {img.width}x{img.height}")


def wordmark_rows(rgba: np.ndarray) -> int:
    """Dernière ligne du bloc « Talent Bridge » + pont : premier intervalle vide sous le pont."""
    occupied = (rgba[..., 3] > 40).sum(axis=1)
    top = int(np.argmax(occupied > 0))
    y = top + int(rgba.shape[0] * 0.55)
    while y < rgba.shape[0] and occupied[y] > 0:
        y += 1
    return y


def main() -> None:
    light = np.asarray(Image.open(SRC / "logo-officiel-fond-blanc.png").convert("RGB"))
    light_a = trim(remove_background(light, (255, 255, 255)))
    save(light_a, "tb-logo.png", 1600)
    cut = wordmark_rows(light_a)
    save(trim(light_a[:cut]), "tb-wordmark.png", 1400)

    dark_src = np.asarray(Image.open(SRC / "logo-officiel-cartouche-bordeaux.png").convert("RGB"))
    # Intérieur du cartouche uniquement : ni coins noirs ni bord arrondi.
    inner = dark_src[95:635, 90:2100]
    bg = tuple(int(v) for v in np.median(inner[5:25, 5:60].reshape(-1, 3), axis=0))
    dark_a = trim(remove_background(inner, bg))
    save(dark_a, "tb-logo-inverse.png", 1600)
    cut = wordmark_rows(dark_a)
    save(trim(dark_a[:cut]), "tb-wordmark-inverse.png", 1400)

    # Pictogramme : uniquement les pixels orange du pont (le texte bordeaux / vert est exclu).
    rgb = light.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    orange = (r > 200) & (g > 60) & (g < 170) & (b < 110) & (r - b > 120)
    picto = remove_background(light, (255, 255, 255))
    picto[..., 3] = np.where(orange, picto[..., 3], 0)
    picto = trim(picto, pad=10)
    save(picto, "tb-pictogramme.png", 900)

    # Icônes carrées (onglet du navigateur, écran d'accueil mobile) à partir du pictogramme.
    pic = Image.fromarray(picto, "RGBA")
    for name, size, background in (("app-icon.png", 512, None), ("apple-touch-icon.png", 180, (255, 255, 255, 255))):
        canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
        inner = int(size * 0.84)
        scaled = pic.resize((inner, round(pic.height * inner / pic.width)), Image.LANCZOS)
        canvas.paste(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2), scaled)
        target = ROOT / "src" / "app" / "icon.png" if name == "app-icon.png" else OUT / name
        canvas.save(target, optimize=True)
        print(f"{target.name}: {size}x{size}")


def backgrounds() -> None:
    """Fond de la page de connexion : zone d'image du fond d'écran n° 1 de la planche fournie
    (carte, ville, pont), sans le logo ni les textes peints ni la légende de la planche."""
    board = Image.open(SRC / "planche-fonds-ecran.png").convert("RGB")
    crop = board.crop((0, 220, 760, 735))
    target = ROOT / "public" / "backgrounds" / "connexion.webp"
    crop.save(target, quality=92, method=6)
    print(f"{target.name}: {crop.width}x{crop.height}")


if __name__ == "__main__":
    main()
    backgrounds()
