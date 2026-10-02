import os
import math
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_gradient_radial(size, center_x, center_y, radius, color_center, color_edge):
    """Generates a soft radial gradient glow."""
    w, h = size
    small_w, small_h = w // 4, h // 4
    small_img = Image.new('RGBA', (small_w, small_h), (0, 0, 0, 0))
    s_cx, s_cy = center_x / 4, center_y / 4
    s_r = radius / 4
    
    r1, g1, b1, a1 = color_center
    r2, g2, b2, a2 = color_edge
    
    for y in range(small_h):
        for x in range(small_w):
            dist = math.sqrt((x - s_cx)**2 + (y - s_cy)**2)
            if dist >= s_r:
                factor = 1.0
            else:
                factor = dist / s_r
                factor = math.sin(factor * math.pi / 2)
                
            r = int(r1 * (1 - factor) + r2 * factor)
            g = int(g1 * (1 - factor) + g2 * factor)
            b = int(b1 * (1 - factor) + b2 * factor)
            a = int(a1 * (1 - factor) + a2 * factor)
            small_img.putpixel((x, y), (r, g, b, a))
            
    img = small_img.resize((w, h), Image.Resampling.BICUBIC)
    return img

def draw_brand_pin_icon(img, cx, cy, size=80, primary_color=(139, 92, 246), secondary_color=(6, 182, 212)):
    """Draws the signature VibeMap glowing pin + lightning bolt at (cx, cy)."""
    scale = size / 100.0
    r = 30 * scale
    tip_y = cy + 40 * scale
    pin_cy = cy - 8 * scale
    
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Outer glow
    draw.ellipse([cx - r*1.4, pin_cy - r*1.4, cx + r*1.4, pin_cy + r*1.4], fill=(*primary_color[:3], 90))
    
    # Tangents
    d = tip_y - pin_cy
    alpha = math.acos(r / d)
    angle_deg = math.degrees(alpha)
    left_x = cx + r * math.cos(math.radians(90 + angle_deg))
    left_y = pin_cy + r * math.sin(math.radians(90 + angle_deg))
    right_x = cx + r * math.cos(math.radians(90 - angle_deg))
    right_y = pin_cy + r * math.sin(math.radians(90 - angle_deg))
    
    # Pin Body
    draw.ellipse([cx - r, pin_cy - r, cx + r, pin_cy + r], fill=primary_color)
    draw.polygon([(left_x, left_y), (right_x, right_y), (cx, tip_y)], fill=secondary_color)
    
    # Inner Dark Glass Circle
    inner_r = r * 0.72
    draw.ellipse([cx - inner_r, pin_cy - inner_r, cx + inner_r, pin_cy + inner_r], fill=(12, 14, 26, 245), outline=(255, 255, 255, 140), width=int(2*scale))
    
    # Lightning Bolt
    bolt_pts = [
        (cx + 2*scale, pin_cy - 14*scale),
        (cx - 9*scale, pin_cy + 1*scale),
        (cx - 1*scale, pin_cy + 1*scale),
        (cx - 4*scale, pin_cy + 14*scale),
        (cx + 9*scale, pin_cy - 1*scale),
        (cx + 1*scale, pin_cy - 1*scale),
    ]
    draw.polygon(bolt_pts, fill=(255, 255, 255, 255), outline=secondary_color)
    
    img.alpha_composite(layer)

def draw_vector_icon(draw, icon_name, cx, cy, size, color=(255, 255, 255)):
    """Draws custom vector icons for flyer bullet points."""
    s = size / 40.0
    
    if icon_name == "traffic": # Traffic Light
        draw.rounded_rectangle([cx - 11*s, cy - 19*s, cx + 11*s, cy + 19*s], radius=int(5*s), fill=(16, 20, 35), outline=color, width=int(2*s))
        draw.ellipse([cx - 5*s, cy - 14*s, cx + 5*s, cy - 6*s], fill=(239, 68, 68)) # red
        draw.ellipse([cx - 5*s, cy - 4*s, cx + 5*s, cy + 4*s], fill=(245, 158, 11)) # yellow
        draw.ellipse([cx - 5*s, cy + 6*s, cx + 5*s, cy + 14*s], fill=(16, 185, 129)) # green
        
    elif icon_name == "compass": # Turn-by-turn navigation / compass
        draw.ellipse([cx - 17*s, cy - 17*s, cx + 17*s, cy + 17*s], outline=color, width=int(2.5*s))
        draw.polygon([(cx, cy - 13*s), (cx + 6*s, cy), (cx - 6*s, cy)], fill=(6, 182, 212))
        draw.polygon([(cx, cy + 13*s), (cx + 6*s, cy), (cx - 6*s, cy)], fill=(210, 220, 240))
        draw.ellipse([cx - 3*s, cy - 3*s, cx + 3*s, cy + 3*s], fill=(255, 255, 255))
        
    elif icon_name == "lightning": # Fast smart rerouting
        pts = [
            (cx + 3*s, cy - 17*s),
            (cx - 11*s, cy + 1*s),
            (cx - 1*s, cy + 1*s),
            (cx - 6*s, cy + 17*s),
            (cx + 11*s, cy - 1*s),
            (cx + 1*s, cy - 1*s),
        ]
        draw.polygon(pts, fill=(245, 158, 11), outline=(255, 255, 255))
        
    elif icon_name == "family": # 24/7 Family Location
        # Center parent
        draw.ellipse([cx - 5*s, cy - 16*s, cx + 5*s, cy - 6*s], fill=color)
        draw.chord([cx - 11*s, cy - 4*s, cx + 11*s, cy + 16*s], 180, 360, fill=color)
        # Left child
        draw.ellipse([cx - 15*s, cy - 9*s, cx - 7*s, cy - 1*s], fill=(6, 182, 212))
        draw.chord([cx - 19*s, cy + 1*s, cx - 3*s, cy + 15*s], 180, 360, fill=(6, 182, 212))
        # Right child
        draw.ellipse([cx + 7*s, cy - 9*s, cx + 15*s, cy - 1*s], fill=(217, 70, 239))
        draw.chord([cx + 3*s, cy + 1*s, cx + 19*s, cy + 15*s], 180, 360, fill=(217, 70, 239))
        
    elif icon_name == "sos": # Siren / SOS Alert
        draw.chord([cx - 13*s, cy - 13*s, cx + 13*s, cy + 13*s], 180, 360, fill=(239, 68, 68), outline=(255, 255, 255), width=int(2*s))
        draw.rectangle([cx - 14*s, cy, cx + 14*s, cy + 8*s], fill=(90, 100, 120))
        draw.line([cx - 17*s, cy - 13*s, cx - 11*s, cy - 9*s], fill=(239, 68, 68), width=int(2.5*s))
        draw.line([cx + 17*s, cy - 13*s, cx + 11*s, cy - 9*s], fill=(239, 68, 68), width=int(2.5*s))
        draw.line([cx, cy - 19*s, cx, cy - 13*s], fill=(239, 68, 68), width=int(2.5*s))
        
    elif icon_name == "shield_lock": # PIN-protected security
        draw.polygon([(cx, cy + 17*s), (cx + 15*s, cy + 3*s), (cx + 15*s, cy - 13*s), (cx, cy - 17*s), (cx - 15*s, cy - 13*s), (cx - 15*s, cy + 3*s)], fill=(16, 185, 129), outline=(255, 255, 255), width=int(2*s))
        draw.ellipse([cx - 4*s, cy - 7*s, cx + 4*s, cy + 1*s], fill=(255, 255, 255))
        draw.polygon([(cx - 2*s, cy), (cx + 2*s, cy), (cx + 3*s, cy + 7*s), (cx - 3*s, cy + 7*s)], fill=(255, 255, 255))
        
    elif icon_name == "party": # Vibe / Party / Event
        draw.polygon([(cx - 13*s, cy - 13*s), (cx + 13*s, cy - 13*s), (cx, cy + 2*s)], fill=(217, 70, 239), outline=(255, 255, 255), width=int(2*s))
        draw.line([cx, cy + 2*s, cx, cy + 15*s], fill=(255, 255, 255), width=int(2.5*s))
        draw.line([cx - 7*s, cy + 15*s, cx + 7*s, cy + 15*s], fill=(255, 255, 255), width=int(2.5*s))
        draw.ellipse([cx - 9*s, cy - 17*s, cx - 5*s, cy - 13*s], fill=(6, 182, 212))
        draw.ellipse([cx + 6*s, cy - 18*s, cx + 11*s, cy - 13*s], fill=(245, 158, 11))
        
    elif icon_name == "roadblock": # Checkpoint / Alert
        draw.polygon([(cx, cy - 17*s), (cx + 13*s, cy + 11*s), (cx - 13*s, cy + 11*s)], fill=(245, 158, 11), outline=(255, 255, 255), width=int(2*s))
        draw.rectangle([cx - 16*s, cy + 11*s, cx + 16*s, cy + 15*s], fill=(200, 200, 210))
        draw.polygon([(cx - 4*s, cy - 8*s), (cx + 4*s, cy - 8*s), (cx + 7*s, cy - 1*s), (cx - 7*s, cy - 1*s)], fill=(255, 255, 255))
        draw.polygon([(cx - 9*s, cy + 3*s), (cx + 9*s, cy + 3*s), (cx + 12*s, cy + 9*s), (cx - 12*s, cy + 9*s)], fill=(255, 255, 255))
        
    elif icon_name == "radar": # Radar / Map visibility
        draw.ellipse([cx - 17*s, cy - 17*s, cx + 17*s, cy + 17*s], outline=color, width=int(2*s))
        draw.ellipse([cx - 9*s, cy - 9*s, cx + 9*s, cy + 9*s], outline=color, width=int(1.5*s))
        draw.line([cx - 17*s, cy, cx + 17*s, cy], fill=color, width=int(1.5*s))
        draw.line([cx, cy - 17*s, cx, cy + 17*s], fill=color, width=int(1.5*s))
        draw.ellipse([cx + 6*s, cy - 7*s, cx + 10*s, cy - 3*s], fill=(239, 68, 68))

def draw_mini_globe(draw, cx, cy, size=24, color=(6, 182, 212)):
    """Draws a crisp mini globe icon next to URL."""
    r = size // 2
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=2)
    draw.ellipse([cx - r//2, cy - r, cx + r//2, cy + r], outline=color, width=1)
    draw.line([cx - r, cy, cx + r, cy], fill=color, width=1)
    draw.line([cx - int(r*0.7), cy - r//2, cx + int(r*0.7), cy - r//2], fill=color, width=1)
    draw.line([cx - int(r*0.7), cy + r//2, cx + int(r*0.7), cy + r//2], fill=color, width=1)

def draw_mini_bolt(draw, cx, cy, size=22, color=(245, 158, 11)):
    """Draws a mini lightning bolt."""
    s = size / 20.0
    pts = [
        (cx + 2*s, cy - 9*s),
        (cx - 6*s, cy + 1*s),
        (cx - 1*s, cy + 1*s),
        (cx - 3*s, cy + 9*s),
        (cx + 6*s, cy - 1*s),
        (cx + 1*s, cy - 1*s),
    ]
    draw.polygon(pts, fill=color)

def draw_mini_shield(draw, cx, cy, size=22, color=(16, 185, 129)):
    """Draws a mini shield."""
    s = size / 20.0
    draw.polygon([(cx, cy + 9*s), (cx + 8*s, cy + 2*s), (cx + 8*s, cy - 7*s), (cx, cy - 9*s), (cx - 8*s, cy - 7*s), (cx - 8*s, cy + 2*s)], fill=color)

def draw_mini_sparkle(draw, cx, cy, size=22, color=(217, 70, 239)):
    """Draws a 4-point sparkle star."""
    s = size / 20.0
    pts = [
        (cx, cy - 9*s),
        (cx + 3*s, cy - 3*s),
        (cx + 9*s, cy),
        (cx + 3*s, cy + 3*s),
        (cx, cy + 9*s),
        (cx - 3*s, cy + 3*s),
        (cx - 9*s, cy),
        (cx - 3*s, cy - 3*s),
    ]
    draw.polygon(pts, fill=color)

def generate_qr_code(url, size=240, border_color=(6, 182, 212), primary_color=(139, 92, 246)):
    """Generates a high-contrast QR code with a stylish frame and center badge."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGBA')
    qr_img = qr_img.resize((size, size), Image.Resampling.LANCZOS)
    
    frame_size = size + 24
    framed = Image.new('RGBA', (frame_size, frame_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(framed)
    
    draw.rounded_rectangle([0, 0, frame_size-1, frame_size-1], radius=16, fill=(255, 255, 255, 255), outline=border_color, width=3)
    framed.alpha_composite(qr_img, (12, 12))
    
    # Center brand emblem on QR
    badge_size = int(size * 0.24)
    badge_cx = frame_size // 2
    badge_cy = frame_size // 2
    badge_r = badge_size // 2
    
    draw.rounded_rectangle([badge_cx - badge_r, badge_cy - badge_r, badge_cx + badge_r, badge_cy + badge_r], radius=8, fill=(12, 14, 26, 255), outline=border_color, width=2)
    mini_scale = badge_size / 40.0
    mini_bolt = [
        (badge_cx + 1*mini_scale, badge_cy - 8*mini_scale),
        (badge_cx - 5*mini_scale, badge_cy + 1*mini_scale),
        (badge_cx - 1*mini_scale, badge_cy + 1*mini_scale),
        (badge_cx - 3*mini_scale, badge_cy + 8*mini_scale),
        (badge_cx + 5*mini_scale, badge_cy - 1*mini_scale),
        (badge_cx + 1*mini_scale, badge_cy - 1*mini_scale),
    ]
    draw.polygon(mini_bolt, fill=(255, 255, 255, 255))
    
    return framed

def draw_background_accents(canvas, flyer_type, scale):
    """Draws themed background visual art (routes for navigation, radar waves for SOS, sparkles for vibes)."""
    W, H = canvas.size
    bg_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bg_layer)
    
    if flyer_type == "nav":
        # Draw glowing route lines
        route_pts = [
            (int(80 * scale), int(420 * scale)),
            (int(380 * scale), int(360 * scale)),
            (int(750 * scale), int(440 * scale)),
            (int(1120 * scale), int(290 * scale)),
        ]
        for i in range(len(route_pts)-1):
            draw.line([route_pts[i], route_pts[i+1]], fill=(6, 182, 212, 35), width=int(10 * scale))
            draw.line([route_pts[i], route_pts[i+1]], fill=(6, 182, 212, 75), width=int(3 * scale))
        for pt in route_pts:
            draw.ellipse([pt[0]-int(10*scale), pt[1]-int(10*scale), pt[0]+int(10*scale), pt[1]+int(10*scale)], fill=(139, 92, 246, 110), outline=(6, 182, 212, 180), width=int(2*scale))
            draw.ellipse([pt[0]-int(4*scale), pt[1]-int(4*scale), pt[0]+int(4*scale), pt[1]+int(4*scale)], fill=(255, 255, 255, 240))
            
    elif flyer_type == "sos":
        # Concentric emergency radar waves
        rcx, rcy = int(1060 * scale), int(210 * scale)
        for r_dist in [int(120*scale), int(220*scale), int(340*scale), int(480*scale)]:
            draw.ellipse([rcx - r_dist, rcy - r_dist, rcx + r_dist, rcy + r_dist], outline=(239, 68, 68, 30), width=int(2.5*scale))
        draw.ellipse([rcx - int(8*scale), rcy - int(8*scale), rcx + int(8*scale), rcy + int(8*scale)], fill=(239, 68, 68, 180))
        
    elif flyer_type == "vibes":
        # Sparkling vibe nodes
        vibe_locs = [
            (int(180 * scale), int(340 * scale), (217, 70, 239)),
            (int(1060 * scale), int(330 * scale), (6, 182, 212)),
            (int(990 * scale), int(740 * scale), (245, 158, 11)),
            (int(130 * scale), int(810 * scale), (139, 92, 246)),
        ]
        for vx, vy, vcolor in vibe_locs:
            draw.ellipse([vx-int(20*scale), vy-int(20*scale), vx+int(20*scale), vy+int(20*scale)], fill=(*vcolor, 35))
            draw.ellipse([vx-int(6*scale), vy-int(6*scale), vx+int(6*scale), vy+int(6*scale)], fill=(*vcolor, 160), outline=(255, 255, 255, 200), width=int(1.5*scale))
            
    canvas.alpha_composite(bg_layer)

def render_flyer(spec, output_path):
    """
    Renders a 2400x2400 canvas supersampled down to 1200x1200 with refined typography, colors & alignment.
    """
    W = 2400
    H = 2400
    scale = 2.0
    
    canvas = Image.new('RGBA', (W, H), (7, 9, 18, 255))
    
    theme_primary = spec['theme_primary'] # Violet / Magenta
    theme_accent = spec['theme_accent']   # Cyan / Red
    theme_tertiary = spec.get('theme_tertiary', (245, 158, 11))
    
    # 1. Cosmic Background Glows
    glow_tr = create_gradient_radial((W, H), W * 0.82, H * 0.16, 950, (*theme_primary, 150), (*theme_primary, 0))
    canvas.alpha_composite(glow_tr)
    
    glow_bl = create_gradient_radial((W, H), W * 0.16, H * 0.84, 950, (*theme_accent, 130), (*theme_accent, 0))
    canvas.alpha_composite(glow_bl)
    
    glow_center = create_gradient_radial((W, H), W * 0.5, H * 0.45, 1100, (*theme_tertiary, 45), (*theme_tertiary, 0))
    canvas.alpha_composite(glow_center)
    
    # Subtle Cyber Grid
    grid_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_layer)
    grid_step = int(80 * scale)
    for gx in range(0, W, grid_step):
        grid_draw.line([(gx, 0), (gx, H)], fill=(255, 255, 255, 10), width=1)
    for gy in range(0, H, grid_step):
        grid_draw.line([(0, gy), (W, gy)], fill=(255, 255, 255, 10), width=1)
    canvas.alpha_composite(grid_layer)
    
    draw_background_accents(canvas, spec['flyer_type'], scale)
    
    # Fonts
    font_logo = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(34 * scale))
    font_tag = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(20 * scale))
    font_headline = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(56 * scale))
    font_pitch = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", int(26 * scale))
    font_hit_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(28 * scale))
    font_hit_desc = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", int(22 * scale))
    font_cta_btn = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(27 * scale))
    font_cta_url = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(28 * scale))
    font_cta_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", int(21 * scale))
    font_sticker = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(27 * scale))
    font_footer = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", int(17 * scale))

    draw = ImageDraw.Draw(canvas)
    
    # ==================== HEADER ROW ====================
    header_y = int(58 * scale)
    
    # Brand Pin Logo (Left)
    draw_brand_pin_icon(canvas, int(85 * scale), header_y + int(20 * scale), size=int(60 * scale), primary_color=theme_primary, secondary_color=theme_accent)
    
    # Brand Name "VIBEMAP"
    draw.text((int(135 * scale), header_y + int(2 * scale)), "VIBEMAP", fill=(255, 255, 255, 255), font=font_logo)
    
    # Tagline
    draw.text((int(137 * scale), header_y + int(36 * scale)), "NIGERIA LIVE SAFETY & NAVIGATION", fill=(185, 200, 225, 220), font=font_footer)
    
    # Right Category Pill
    tag_text = spec['badge_text']
    tag_w = int(draw.textlength(tag_text, font=font_tag) + 48 * scale)
    tag_h = int(46 * scale)
    tag_x = W - int(80 * scale) - tag_w
    tag_y = header_y + int(5 * scale)
    
    draw.rounded_rectangle([tag_x, tag_y, tag_x + tag_w, tag_y + tag_h], radius=int(23 * scale), fill=(*theme_primary[:3], 80), outline=theme_accent, width=int(2 * scale))
    
    mini_icon_x = tag_x + int(22 * scale)
    mini_icon_y = tag_y + int(23 * scale)
    if spec['flyer_type'] == 'nav':
        draw_mini_bolt(draw, mini_icon_x, mini_icon_y, size=int(18 * scale), color=theme_accent)
    elif spec['flyer_type'] == 'sos':
        draw_mini_shield(draw, mini_icon_x, mini_icon_y, size=int(18 * scale), color=(239, 68, 68))
    else:
        draw_mini_sparkle(draw, mini_icon_x, mini_icon_y, size=int(18 * scale), color=(217, 70, 239))
        
    draw.text((tag_x + int(38 * scale), tag_y + int(9 * scale)), tag_text, fill=(255, 255, 255, 255), font=font_tag)
    
    # Header divider
    draw.line([(int(80 * scale), header_y + int(70 * scale)), (W - int(80 * scale), header_y + int(70 * scale))], fill=(255, 255, 255, 28), width=int(1.5 * scale))

    # ==================== MAIN HEADLINE & PITCH ====================
    content_y = header_y + int(100 * scale)
    
    # Headline Line 1: Pure White
    # Headline Line 2: Accent Glow
    headline_lines = spec['headline'].split('\n')
    line1 = headline_lines[0]
    line2 = headline_lines[1] if len(headline_lines) > 1 else ""
    
    # Draw Line 1 (White)
    draw.text((int(82 * scale), content_y + int(3 * scale)), line1, fill=(0, 0, 0, 220), font=font_headline)
    draw.text((int(80 * scale), content_y), line1, fill=(255, 255, 255, 255), font=font_headline)
    content_y += int(68 * scale)
    
    # Draw Line 2 (Accent Color with Glow)
    if line2:
        draw.text((int(82 * scale), content_y + int(3 * scale)), line2, fill=(0, 0, 0, 220), font=font_headline)
        draw.text((int(80 * scale), content_y), line2, fill=theme_accent, font=font_headline)
        content_y += int(72 * scale)
        
    content_y += int(8 * scale)
    
    # Pitch Glass Card
    pitch_card_x0 = int(80 * scale)
    pitch_card_y0 = content_y
    pitch_card_x1 = W - int(80 * scale)
    pitch_card_h = int(124 * scale)
    pitch_card_y1 = pitch_card_y0 + pitch_card_h
    
    draw.rounded_rectangle([pitch_card_x0, pitch_card_y0, pitch_card_x1, pitch_card_y1], radius=int(18 * scale), fill=(18, 22, 45, 185), outline=(*theme_accent[:3], 130), width=int(1.5 * scale))
    draw.rounded_rectangle([pitch_card_x0, pitch_card_y0, pitch_card_x0 + int(8 * scale), pitch_card_y1], radius=int(4 * scale), fill=theme_accent)
    
    words = spec['pitch'].split()
    lines = []
    curr_line = []
    max_w = pitch_card_x1 - pitch_card_x0 - int(52 * scale)
    for word in words:
        test_line = " ".join(curr_line + [word])
        if draw.textlength(test_line, font=font_pitch) <= max_w:
            curr_line.append(word)
        else:
            lines.append(" ".join(curr_line))
            curr_line = [word]
    if curr_line:
        lines.append(" ".join(curr_line))
        
    py = pitch_card_y0 + int(21 * scale)
    for pline in lines:
        draw.text((pitch_card_x0 + int(28 * scale), py), pline, fill=(230, 240, 255, 245), font=font_pitch)
        py += int(34 * scale)

    # ==================== QUICK HITS (3 FEATURE CARDS) ====================
    hits_y = pitch_card_y1 + int(32 * scale)
    
    # Section Title
    sec_title = "CORE HIGHLIGHTS"
    draw_mini_bolt(draw, int(92 * scale), hits_y + int(12 * scale), size=int(20 * scale), color=theme_accent)
    draw.text((int(112 * scale), hits_y), sec_title, fill=theme_accent, font=font_tag)
    hits_y += int(36 * scale)
    
    card_h = int(105 * scale)
    card_gap = int(18 * scale)
    
    for idx, hit in enumerate(spec['quick_hits']):
        cy0 = hits_y + idx * (card_h + card_gap)
        cy1 = cy0 + card_h
        cx0 = int(80 * scale)
        cx1 = W - int(80 * scale)
        
        draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=int(16 * scale), fill=(15, 18, 38, 215), outline=(*theme_primary[:3], 110), width=int(1.5 * scale))
        
        # Icon Circle Badge
        icon_cx = cx0 + int(50 * scale)
        icon_cy = (cy0 + cy1) // 2
        icon_r = int(32 * scale)
        draw.ellipse([icon_cx - icon_r, icon_cy - icon_r, icon_cx + icon_r, icon_cy + icon_r], fill=(*theme_primary[:3], 95), outline=theme_accent, width=int(1.5 * scale))
        
        draw_vector_icon(draw, hit['icon'], icon_cx, icon_cy, size=int(32 * scale), color=(255, 255, 255))
        
        text_x = icon_cx + icon_r + int(22 * scale)
        title_y = cy0 + int(22 * scale)
        desc_y = title_y + int(34 * scale)
        
        draw.text((text_x, title_y), hit['title'], fill=(255, 255, 255, 255), font=font_hit_title)
        draw.text((text_x, desc_y), hit['desc'], fill=(170, 185, 215, 235), font=font_hit_desc)
        
    hits_bottom_y = hits_y + 3 * (card_h + card_gap)

    # ==================== CTA & QR CODE SECTION ====================
    cta_y = hits_bottom_y + int(18 * scale)
    cta_box_h = int(225 * scale)
    cta_x0 = int(80 * scale)
    cta_x1 = W - int(80 * scale)
    
    draw.rounded_rectangle([cta_x0, cta_y, cta_x1, cta_y + cta_box_h], radius=int(22 * scale), fill=(18, 22, 46, 235), outline=(*theme_accent[:3], 170), width=int(2 * scale))
    
    # QR Code (Left)
    qr_url = spec['qr_url']
    qr_img = generate_qr_code(qr_url, size=int(155 * scale), border_color=theme_accent, primary_color=theme_primary)
    
    qr_x = cta_x0 + int(25 * scale)
    qr_y = cta_y + (cta_box_h - qr_img.height) // 2
    canvas.alpha_composite(qr_img, (qr_x, qr_y))
    
    # Right Action Content
    right_x = qr_x + qr_img.width + int(35 * scale)
    
    # Large Action Button
    btn_w = cta_x1 - right_x - int(25 * scale)
    btn_h = int(66 * scale)
    btn_y = cta_y + int(26 * scale)
    
    draw.rounded_rectangle([right_x, btn_y, right_x + btn_w, btn_y + btn_h], radius=int(14 * scale), fill=theme_accent, outline=(255, 255, 255, 230), width=int(1.5 * scale))
    btn_text = spec['cta_btn']
    btn_text_w = draw.textlength(btn_text, font=font_cta_btn)
    draw.text((right_x + (btn_w - btn_text_w) // 2, btn_y + int(17 * scale)), btn_text, fill=(10, 14, 30, 255), font=font_cta_btn)
    
    # Domain Link with Mini Globe
    domain_y = btn_y + btn_h + int(22 * scale)
    draw_mini_globe(draw, right_x + int(12 * scale), domain_y + int(15 * scale), size=int(22 * scale), color=theme_accent)
    draw.text((right_x + int(32 * scale), domain_y), "vibemap.tech", fill=(255, 255, 255, 255), font=font_cta_url)
    
    # Subtitle
    sub_y = domain_y + int(36 * scale)
    sub_text = spec['cta_sub']
    draw.text((right_x, sub_y), sub_text, fill=(185, 200, 230, 235), font=font_cta_sub)

    # ==================== FOOTER STICKER LINE ====================
    footer_y = cta_y + cta_box_h + int(26 * scale)
    
    sticker_h = int(62 * scale)
    sticker_w = W - int(160 * scale)
    sticker_x = int(80 * scale)
    
    # Glowing Ribbon Badge
    draw.rounded_rectangle([sticker_x, footer_y, sticker_x + sticker_w, footer_y + sticker_h], radius=int(31 * scale), fill=(*theme_primary[:3], 85), outline=theme_accent, width=int(2 * scale))
    
    sticker_text = spec['sticker_line']
    st_text_w = draw.textlength(sticker_text, font=font_sticker)
    st_icon_w = int(28 * scale)
    st_gap = int(12 * scale)
    total_st_w = st_icon_w + st_gap + int(st_text_w)
    
    st_start_x = sticker_x + (sticker_w - total_st_w) // 2
    icon_center_x = st_start_x + st_icon_w // 2
    icon_center_y = footer_y + sticker_h // 2
    text_start_x = st_start_x + st_icon_w + st_gap
    
    # Draw centered icon before sticker text
    if spec['flyer_type'] == 'nav':
        draw_mini_bolt(draw, icon_center_x, icon_center_y, size=int(22 * scale), color=theme_accent)
    elif spec['flyer_type'] == 'sos':
        draw_mini_shield(draw, icon_center_x, icon_center_y, size=int(22 * scale), color=(239, 68, 68))
    else:
        draw_mini_sparkle(draw, icon_center_x, icon_center_y, size=int(22 * scale), color=(217, 70, 239))
        
    draw.text((text_start_x, footer_y + int(13 * scale)), sticker_text, fill=(255, 255, 255, 255), font=font_sticker)
    
    # Bottom tag line
    bot_y = footer_y + sticker_h + int(18 * scale)
    bot_text = "BUILT FOR NIGERIA • INSTANT ACCESS ON WEB & ANDROID APK • 100% FREE"
    bot_w = draw.textlength(bot_text, font=font_footer)
    draw.text(((W - bot_w) // 2, bot_y), bot_text, fill=(140, 155, 185, 190), font=font_footer)

    # Downsample from 2400x2400 to 1200x1200 with LANCZOS
    final_img = canvas.resize((1200, 1200), Image.Resampling.LANCZOS)
    
    final_img.convert('RGB').save(output_path, 'JPEG', quality=96, optimize=True)
    png_path = output_path.replace('.jpg', '.png')
    final_img.save(png_path, 'PNG', optimize=True)
    
    print(f"Rendered: {output_path} and {png_path}")

# ==================== SPECIFICATIONS ====================

flyers = [
    {
        "id": "flyer_1_navigation",
        "flyer_type": "nav",
        "output_path": "public/flyers/vibemap_flyer_1_navigation.jpg",
        "theme_primary": (139, 92, 246), # Electric Violet
        "theme_accent": (6, 182, 212),   # Vivid Cyan
        "theme_tertiary": (16, 185, 129), # Emerald Green
        "badge_text": "SMART NAVIGATION",
        "headline": "Navigate Nigeria.\nNever Guess Again.",
        "pitch": "VibeMap gives you real-time, traffic-aware routing built for Nigerian roads — highways, estates, backstreets, all covered. Know before you go.",
        "quick_hits": [
            {
                "icon": "traffic",
                "title": "Live Traffic-Aware Routing",
                "desc": "Real-time updates bypass notorious go-slows & gridlocks"
            },
            {
                "icon": "compass",
                "title": "Turn-by-Turn Nationwide Coverage",
                "desc": "Highways, estates & backstreets from Lagos to Abuja & beyond"
            },
            {
                "icon": "lightning",
                "title": "Smart Instant Rerouting",
                "desc": "Auto-adapts dynamically whenever road conditions shift"
            }
        ],
        "cta_btn": "SCAN TO NAVIGATE SMARTER",
        "qr_url": "https://www.vibemap.tech/?ref=flyer-nav",
        "cta_sub": "Free. No app store needed. Just scan and go.",
        "sticker_line": '"The road knows you\'re coming."'
    },
    {
        "id": "flyer_2_familymap_sos",
        "flyer_type": "sos",
        "output_path": "public/flyers/vibemap_flyer_2_familymap_sos.jpg",
        "theme_primary": (139, 92, 246), # Violet
        "theme_accent": (239, 68, 68),   # Alert Crimson Red
        "theme_tertiary": (245, 158, 11), # Amber
        "badge_text": "FAMILY MAP & SOS",
        "headline": "Know They're Safe.\nInstantly.",
        "pitch": "VibeMap keeps your family visible in real time — even with the phone locked — and puts help one tap away when it matters most.",
        "quick_hits": [
            {
                "icon": "family",
                "title": "24/7 Live Family Location",
                "desc": "Continuous background location sharing, even screen-locked"
            },
            {
                "icon": "sos",
                "title": "One-Tap Emergency SOS Alarm",
                "desc": "High-decibel siren, lockscreen alert & live GPS broadcast"
            },
            {
                "icon": "shield_lock",
                "title": "PIN-Protected Security",
                "desc": "Tamper-proof distress protocols ensure zero false alarms"
            }
        ],
        "cta_btn": "SCAN TO PROTECT YOUR PEOPLE",
        "qr_url": "https://www.vibemap.tech/?ref=flyer-sos",
        "cta_sub": 'Because "are you okay?" shouldn\'t be a guess.',
        "sticker_line": '"Never out of reach."'
    },
    {
        "id": "flyer_3_vibes",
        "flyer_type": "vibes",
        "output_path": "public/flyers/vibemap_flyer_3_vibes.jpg",
        "theme_primary": (217, 70, 239), # Neon Magenta
        "theme_accent": (6, 182, 212),   # Electric Cyan
        "theme_tertiary": (139, 92, 246), # Purple
        "badge_text": "COMMUNITY VIBES",
        "headline": "Know the Vibe Before\nYou Get There.",
        "pitch": "Real people, real-time reports — parties, roadblocks, police checks, unsafe spots. VibeMap shows you what's actually happening around you, right now.",
        "quick_hits": [
            {
                "icon": "party",
                "title": "Live Area Community Reports",
                "desc": "Real-time crowdsourced updates on night spots & social events"
            },
            {
                "icon": "roadblock",
                "title": "Roadblocks & Checkpoints Flagged",
                "desc": "Instant heads-up on police checks, protests & hazards"
            },
            {
                "icon": "radar",
                "title": "See It Before You're Stuck",
                "desc": "Stay ahead of the city's pulse and move with total confidence"
            }
        ],
        "cta_btn": "SCAN TO SEE THE VIBE",
        "qr_url": "https://www.vibemap.tech/?ref=flyer-vibes",
        "cta_sub": "The city's talking. VibeMap's listening.",
        "sticker_line": '"Don\'t walk in blind."'
    }
]

if __name__ == "__main__":
    for spec in flyers:
        print(f"Generating {spec['id']}...")
        render_flyer(spec, spec['output_path'])
    print("All 3 flyers regenerated successfully!")
