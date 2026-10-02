import zlib
import struct
import math

def create_png(width, height, draw_func):
    """Creates a PNG image with RGBA pixels rendered by draw_func(x, y, width, height) -> (r, g, b, a)"""
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([int(r), int(g), int(b), int(a)])
    
    compressed_data = zlib.compress(raw_data, 9)
    
    def make_chunk(chunk_type, data):
        length = len(data)
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack('>I', length) + chunk_type + data + struct.pack('>I', crc)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(make_chunk(b'IHDR', ihdr_data))
    # IDAT
    png.extend(make_chunk(b'IDAT', compressed_data))
    # IEND
    png.extend(make_chunk(b'IEND', b''))
    return bytes(png)

def vibemap_icon_shader(x, y, w, h):
    # Normalized coords from -1 to 1
    nx = (x / w) * 2.0 - 1.0
    ny = (y / h) * 2.0 - 1.0
    r_dist = math.sqrt(nx*nx + ny*ny)
    
    # Rounded squircle background
    squircle_dist = (nx**4 + ny**4)**0.25
    if squircle_dist > 0.95:
        # Transparent outside squircle
        if squircle_dist > 1.0:
            return (0, 0, 0, 0)
        # Antialiased border
        alpha = int((1.0 - squircle_dist) / 0.05 * 255)
        return (139, 92, 246, alpha)
    
    # Background gradient: Dark Cyberpunk Slate with Deep Indigo Glow
    bg_factor = (ny + 1.0) * 0.5
    bg_r = int(12 + (20 - 12) * bg_factor)
    bg_g = int(14 + (10 - 14) * bg_factor)
    bg_b = int(28 + (38 - 28) * bg_factor)
    
    # Glowing neon halo at center
    glow = max(0.0, 1.0 - r_dist * 1.4)
    glow_intensity = glow ** 2
    
    r = min(255, bg_r + int(glow_intensity * 120))
    g = min(255, bg_g + int(glow_intensity * 60))
    b = min(255, bg_b + int(glow_intensity * 240))
    
    # Border glow
    if squircle_dist > 0.88:
        border_glow = (squircle_dist - 0.88) / 0.07
        r = min(255, int(r * (1 - border_glow) + 139 * border_glow))
        g = min(255, int(g * (1 - border_glow) + 92 * border_glow))
        b = min(255, int(b * (1 - border_glow) + 246 * border_glow))

    # Lightning Bolt & Safety Pin Geometry
    # Lightning path points in normalized coords:
    # Top right to center to bottom left
    # Shape: P1(0.15, -0.6) -> P2(-0.35, -0.05) -> P3(0.0, -0.05) -> P4(-0.2, 0.65) -> P5(0.35, -0.05) -> P6(0.0, -0.05) -> P1
    # Simple polygon test or distance field for lightning
    
    # Lightning upper segment: from (0.1, -0.55) to (-0.25, 0.05)
    # Lightning lower segment: from (0.05, -0.05) to (-0.15, 0.6)
    
    in_lightning = False
    
    # Check if point is inside lightning bolt triangles
    # Triangle 1 (upper bolt): (-0.25, 0.05), (0.15, -0.55), (0.1, 0.05)
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    
    def pt_in_tri(pt, v1, v2, v3):
        d1 = sign(pt, v1, v2)
        d2 = sign(pt, v2, v3)
        d3 = sign(pt, v3, v1)
        has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
        has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
        return not (has_neg and has_pos)
    
    t1 = pt_in_tri((nx, ny), (-0.35, 0.02), (0.18, -0.62), (0.05, 0.02))
    t2 = pt_in_tri((nx, ny), (-0.12, 0.62), (0.32, -0.05), (-0.08, -0.05))
    t3 = pt_in_tri((nx, ny), (-0.08, -0.05), (0.05, 0.02), (-0.12, 0.62))
    
    if t1 or t2 or t3:
        in_lightning = True
    
    # Map pin circle at top
    pin_cx, pin_cy = 0.0, -0.02
    pin_dist = math.sqrt((nx - pin_cx)**2 + (ny - pin_cy)**2)
    
    if in_lightning:
        # Vibrant electric gradient from Cyan (#06b6d4) at top to Vivid Violet (#a855f7) to Bright White highlight
        bolt_grad = (ny + 0.6) / 1.2
        bolt_r = int(6 + (217 - 6) * bolt_grad)
        bolt_g = int(182 + (70 - 182) * bolt_grad)
        bolt_b = int(212 + (239 - 212) * bolt_grad)
        
        # Center core shine
        core_shine = max(0.0, 1.0 - abs(nx) * 5.0)
        bolt_r = min(255, bolt_r + int(core_shine * 90))
        bolt_g = min(255, bolt_g + int(core_shine * 90))
        bolt_b = min(255, bolt_b + int(core_shine * 90))
        
        return (bolt_r, bolt_g, bolt_b, 255)
    
    return (r, g, b, 255)

print("Rendering 192x192 icon...")
icon_192 = create_png(192, 192, vibemap_icon_shader)
with open('public/icon-192.png', 'wb') as f:
    f.write(icon_192)

print("Rendering 512x512 icon...")
icon_512 = create_png(512, 512, vibemap_icon_shader)
with open('public/icon-512.png', 'wb') as f:
    f.write(icon_512)
with open('public/icon-maskable-512.png', 'wb') as f:
    f.write(icon_512)
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(icon_512)
with open('public/favicon.png', 'wb') as f:
    f.write(create_png(64, 64, vibemap_icon_shader))

print("All PNG icons created successfully!")
