import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def generate_brand_logo(size=512, include_text=True):
    """Generates the VibeMap brand map-pin & lightning logo."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    scale = size / 512.0
    
    # Pin Geometry
    cx = 256 * scale
    cy = 190 * scale if include_text else 235 * scale
    r = 135 * scale if include_text else 155 * scale
    
    tip_x = 256 * scale
    tip_y = 410 * scale if include_text else 460 * scale
    
    d = tip_y - cy
    alpha = math.acos(r / d)
    angle_deg = math.degrees(alpha)
    
    left_angle = 90 + angle_deg
    right_angle = 90 - angle_deg
    
    left_x = cx + r * math.cos(math.radians(left_angle))
    left_y = cy + r * math.sin(math.radians(left_angle))
    right_x = cx + r * math.cos(math.radians(right_angle))
    right_y = cy + r * math.sin(math.radians(right_angle))
    
    # 1. Glow Layer
    glow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.ellipse([cx - r*1.25, cy - r*1.25, cx + r*1.25, cy + r*1.25], fill=(139, 92, 246, 90))
    glow_draw.polygon([(left_x, left_y), (right_x, right_y), (tip_x, tip_y + 12*scale)], fill=(6, 182, 212, 90))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(14 * scale))
    img.alpha_composite(glow_layer)
    
    # 2. Main Gradient Pin Body
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    mask_draw.polygon([(left_x, left_y), (right_x, right_y), (tip_x, tip_y)], fill=255)
    
    grad = Image.new('RGBA', (size, size))
    for y_idx in range(size):
        t = y_idx / size
        red = int(139 * (1 - t) + 6 * t)
        green = int(92 * (1 - t) + 182 * t)
        blue = int(246 * (1 - t) + 212 * t)
        for x_idx in range(size):
            grad.putpixel((x_idx, y_idx), (red, green, blue, 255))
            
    pin_layer = Image.composite(grad, Image.new('RGBA', (size, size), (0,0,0,0)), mask)
    img.alpha_composite(pin_layer)
    
    # 3. Inner Dark Glass Circle
    inner_r = r * 0.76
    inner_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner_draw = ImageDraw.Draw(inner_layer)
    inner_draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(12, 14, 26, 245))
    inner_draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], outline=(255, 255, 255, 80), width=max(1, int(2*scale)))
    img.alpha_composite(inner_layer)
    
    # 4. Lightning Bolt
    draw = ImageDraw.Draw(img)
    bolt_scale = scale * (1.15 if not include_text else 1.0)
    bolt_pts = [
        (cx + 8*bolt_scale, cy - 65*bolt_scale),
        (cx - 36*bolt_scale, cy + 2*bolt_scale),
        (cx - 4*bolt_scale, cy + 2*bolt_scale),
        (cx - 18*bolt_scale, cy + 65*bolt_scale),
        (cx + 36*bolt_scale, cy - 2*bolt_scale),
        (cx + 4*bolt_scale, cy - 2*bolt_scale),
    ]
    draw.polygon(bolt_pts, fill=(255, 255, 255, 255))
    draw.polygon(bolt_pts, outline=(6, 182, 212, 255))
    
    if include_text:
        banner_y = 428 * scale
        try:
            font_large = ImageFont.truetype("arialbd.ttf", int(36 * scale))
        except Exception:
            try:
                font_large = ImageFont.truetype("arial.ttf", int(36 * scale))
            except Exception:
                font_large = ImageFont.load_default()
                
        text = "VIBEMAP"
        draw.text((cx - 2*scale, banner_y + 2*scale), text, fill=(0, 0, 0, 180), font=font_large, anchor="mm")
        draw.text((cx, banner_y), text, fill=(255, 255, 255, 255), font=font_large, anchor="mm")
    
    return img

def generate_legacy_icon(size, shape='square'):
    """Generates standard legacy launcher icon with dark brand background."""
    bg_color = (12, 14, 26, 255) # #0c0e1a
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    if shape == 'round':
        draw.ellipse([1, 1, size - 2, size - 2], fill=bg_color)
        draw.ellipse([1, 1, size - 2, size - 2], outline=(139, 92, 246, 120), width=max(1, int(size * 0.02)))
    else:
        # Rounded squircle
        corner_r = int(size * 0.22)
        draw.rounded_rectangle([1, 1, size - 2, size - 2], radius=corner_r, fill=bg_color)
        draw.rounded_rectangle([1, 1, size - 2, size - 2], radius=corner_r, outline=(139, 92, 246, 120), width=max(1, int(size * 0.02)))
    
    logo_size = int(size * 0.78)
    logo = generate_brand_logo(logo_size, include_text=False)
    offset = (size - logo_size) // 2
    img.alpha_composite(logo, (offset, offset))
    return img

def generate_adaptive_foreground(size):
    """Generates Android adaptive icon foreground (108dp canvas with centered safe logo)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # Safe zone for adaptive icons is center 66% - 70%
    logo_size = int(size * 0.65)
    logo = generate_brand_logo(logo_size, include_text=False)
    offset = (size - logo_size) // 2
    img.alpha_composite(logo, (offset, offset))
    return img

def generate_splash(w, h):
    """Generates splash screen with dark background and centered branded logo."""
    img = Image.new('RGBA', (w, h), (12, 14, 26, 255))
    min_dim = min(w, h)
    logo_size = int(min_dim * 0.45)
    logo = generate_brand_logo(logo_size, include_text=True)
    offset_x = (w - logo_size) // 2
    offset_y = (h - logo_size) // 2
    img.alpha_composite(logo, (offset_x, offset_y))
    return img

# 1. Output directories
RES_DIR = 'android/app/src/main/res'

MIPMAP_SIZES = {
    'mipmap-mdpi': {'icon': 48, 'foreground': 108},
    'mipmap-hdpi': {'icon': 72, 'foreground': 162},
    'mipmap-xhdpi': {'icon': 96, 'foreground': 216},
    'mipmap-xxhdpi': {'icon': 144, 'foreground': 324},
    'mipmap-xxxhdpi': {'icon': 192, 'foreground': 432},
}

SPLASH_SIZES = {
    'drawable': (480, 800),
    'drawable-port-mdpi': (320, 480),
    'drawable-port-hdpi': (480, 800),
    'drawable-port-xhdpi': (720, 1280),
    'drawable-port-xxhdpi': (960, 1600),
    'drawable-port-xxxhdpi': (1280, 1920),
    'drawable-land-mdpi': (480, 320),
    'drawable-land-hdpi': (800, 480),
    'drawable-land-xhdpi': (1280, 720),
    'drawable-land-xxhdpi': (1600, 960),
    'drawable-land-xxxhdpi': (1920, 1280),
}

print("Generating Android Launcher Icons...")
for folder, sizes in MIPMAP_SIZES.items():
    target_dir = os.path.join(RES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    
    # 1. Standard Square / Squircle Launcher Icon
    ic_square = generate_legacy_icon(sizes['icon'], shape='square')
    ic_square.save(os.path.join(target_dir, 'ic_launcher.png'), 'PNG')
    
    # 2. Round Launcher Icon
    ic_round = generate_legacy_icon(sizes['icon'], shape='round')
    ic_round.save(os.path.join(target_dir, 'ic_launcher_round.png'), 'PNG')
    
    # 3. Adaptive Foreground Icon
    ic_fg = generate_adaptive_foreground(sizes['foreground'])
    ic_fg.save(os.path.join(target_dir, 'ic_launcher_foreground.png'), 'PNG')
    print(f"Generated icons for {folder}: icon={sizes['icon']}px, fg={sizes['foreground']}px")

print("\nGenerating Android Splash Screens...")
for folder, (w, h) in SPLASH_SIZES.items():
    target_dir = os.path.join(RES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    splash_img = generate_splash(w, h)
    splash_img.save(os.path.join(target_dir, 'splash.png'), 'PNG')
    print(f"Generated splash for {folder}: {w}x{h}px")

# Also update public/ web assets
print("\nUpdating public web icons...")
pub_512 = generate_brand_logo(512, include_text=True)
pub_512.save('public/icon-512.png', 'PNG')
pub_512.save('public/icon-maskable-512.png', 'PNG')
pub_512.save('public/apple-touch-icon.png', 'PNG')

pub_192 = generate_brand_logo(192, include_text=True)
pub_192.save('public/icon-192.png', 'PNG')

pub_favicon = generate_brand_logo(64, include_text=False)
pub_favicon.save('public/favicon.png', 'PNG')

print("\nAll Android APK icons and Splash screens updated successfully!")
