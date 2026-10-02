import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def generate_brand_icon(size=512):
    # Create image with transparent background (RGBA, 0 alpha)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    scale = size / 512.0
    
    # 1. Map Pin Geometry
    # Pin head circle center (cx, cy) and radius r
    cx = 256 * scale
    cy = 190 * scale
    r = 135 * scale
    
    # Point at bottom
    tip_x = 256 * scale
    tip_y = 410 * scale
    
    # Tangent points from tip to circle
    # Distance from center to tip
    d = tip_y - cy
    # angle
    alpha = math.acos(r / d)
    angle_deg = math.degrees(alpha)
    
    left_angle = 90 + angle_deg
    right_angle = 90 - angle_deg
    
    left_x = cx + r * math.cos(math.radians(left_angle))
    left_y = cy + r * math.sin(math.radians(left_angle))
    
    right_x = cx + r * math.cos(math.radians(right_angle))
    right_y = cy + r * math.sin(math.radians(right_angle))
    
    # Draw glowing backdrop aura on temporary layer
    glow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Outer glow
    glow_draw.ellipse([cx - r*1.3, cy - r*1.3, cx + r*1.3, cy + r*1.3], fill=(139, 92, 246, 70))
    glow_draw.polygon([(left_x, left_y), (right_x, right_y), (tip_x, tip_y + 15*scale)], fill=(6, 182, 212, 70))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(15 * scale))
    img.alpha_composite(glow_layer)
    
    # 2. Main Gradient Pin Body
    pin_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pin_draw = ImageDraw.Draw(pin_layer)
    
    # Pin top arc + triangle to tip
    # We will draw multi-color horizontal gradient scanlines
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    
    # Draw filled pin on mask
    mask_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    mask_draw.polygon([(left_x, left_y), (right_x, right_y), (tip_x, tip_y)], fill=255)
    
    # Generate vertical purple-to-cyan gradient
    grad = Image.new('RGBA', (size, size))
    for y_idx in range(size):
        t = y_idx / size
        # #8b5cf6 (139, 92, 246) -> #06b6d4 (6, 182, 212)
        red = int(139 * (1 - t) + 6 * t)
        green = int(92 * (1 - t) + 182 * t)
        blue = int(246 * (1 - t) + 212 * t)
        for x_idx in range(size):
            grad.putpixel((x_idx, y_idx), (red, green, blue, 255))
            
    pin_layer = Image.composite(grad, Image.new('RGBA', (size, size), (0,0,0,0)), mask)
    img.alpha_composite(pin_layer)
    
    # 3. Inner Dark Glass Circle for high contrast
    inner_r = r * 0.76
    inner_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner_draw = ImageDraw.Draw(inner_layer)
    inner_draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(12, 14, 26, 240))
    inner_draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], outline=(255, 255, 255, 60), width=int(2*scale))
    img.alpha_composite(inner_layer)
    
    # 4. Draw Electric Lightning + "VM" Text inside inner circle
    draw = ImageDraw.Draw(img)
    
    # Lightning Bolt Coordinates in center
    bolt_pts = [
        (cx + 8*scale, cy - 65*scale),
        (cx - 36*scale, cy + 2*scale),
        (cx - 4*scale, cy + 2*scale),
        (cx - 18*scale, cy + 65*scale),
        (cx + 36*scale, cy - 2*scale),
        (cx + 4*scale, cy - 2*scale),
    ]
    draw.polygon(bolt_pts, fill=(255, 255, 255, 255))
    
    # Outline of bolt in vivid cyan
    draw.polygon(bolt_pts, outline=(6, 182, 212, 255))
    
    # 5. "VIBEMAP" Text Badge below the pin head
    # Draw crisp professional text banner
    banner_y = 425 * scale
    banner_w = 260 * scale
    banner_h = 44 * scale
    
    # Draw text directly
    # Try to load Arial or default font
    try:
        font_large = ImageFont.truetype("arialbd.ttf", int(36 * scale))
        font_sub = ImageFont.truetype("arial.ttf", int(18 * scale))
    except Exception:
        try:
            font_large = ImageFont.truetype("arial.ttf", int(36 * scale))
            font_sub = font_large
        except Exception:
            font_large = ImageFont.load_default()
            font_sub = font_large
            
    # Text: "VIBEMAP"
    text = "VIBEMAP"
    
    # Shadow
    draw.text((cx - 2*scale, banner_y + 2*scale), text, fill=(0, 0, 0, 180), font=font_large, anchor="mm")
    # Glowing Text
    draw.text((cx, banner_y), text, fill=(255, 255, 255, 255), font=font_large, anchor="mm")
    
    return img

print("Generating transparent brand icons...")
icon_512 = generate_brand_icon(512)
icon_512.save('public/icon-512.png', 'PNG')
icon_512.save('public/icon-maskable-512.png', 'PNG')
icon_512.save('public/apple-touch-icon.png', 'PNG')

icon_192 = generate_brand_icon(192)
icon_192.save('public/icon-192.png', 'PNG')

icon_64 = generate_brand_icon(64)
icon_64.save('public/favicon.png', 'PNG')

print("All transparent VibeMap brand icons generated successfully!")
