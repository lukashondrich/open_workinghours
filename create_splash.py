#!/usr/bin/env python3
"""
Create splash screen for Open Working Hours
Centers logo on 1242x2436px white canvas (iPhone portrait dimensions)
"""

from PIL import Image

# iPhone splash screen dimensions (portrait)
SPLASH_WIDTH = 1242
SPLASH_HEIGHT = 2436

# Load the logo
logo = Image.open('logo_for_mvp.png')
print(f"Logo size: {logo.size}")

# Create white canvas
splash = Image.new('RGB', (SPLASH_WIDTH, SPLASH_HEIGHT), 'white')

# Calculate logo size (keep it reasonable - not too big)
# Let's make it about 40% of screen width
target_logo_width = int(SPLASH_WIDTH * 0.4)
aspect_ratio = logo.height / logo.width
target_logo_height = int(target_logo_width * aspect_ratio)

# Resize logo
logo_resized = logo.resize((target_logo_width, target_logo_height), Image.Resampling.LANCZOS)
print(f"Resized logo to: {logo_resized.size}")

# Calculate position to center the logo
x = (SPLASH_WIDTH - target_logo_width) // 2
y = (SPLASH_HEIGHT - target_logo_height) // 2

# Paste logo onto white canvas
# Handle transparency if logo has alpha channel
if logo_resized.mode == 'RGBA':
    splash.paste(logo_resized, (x, y), logo_resized)
else:
    splash.paste(logo_resized, (x, y))

# Save splash screen
output_path = 'mobile-app/assets/splash-icon.png'
splash.save(output_path, 'PNG')
print(f"✅ Splash screen created: {output_path}")
print(f"   Size: {SPLASH_WIDTH}x{SPLASH_HEIGHT}px")
print(f"   Background: white")
print(f"   Logo centered: {target_logo_width}x{target_logo_height}px")
