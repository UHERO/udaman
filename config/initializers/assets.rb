# Be sure to restart your server when you modify this file.

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = '1.0'

# Add additional assets to the asset load path.
# Rails.application.config.assets.paths << Emoji.images_path
# Add Yarn node_modules folder to the asset load path.
Rails.application.config.assets.paths << Rails.root.join('node_modules')

# Precompile additional assets.
# application.js, application.css, and all non-JS/CSS in the app/assets
# folder are already added.
# Rails.application.config.assets.precompile += %w( admin.js admin.css )
Rails.application.config.assets.precompile += %w(
  non_prod_style.scss
  humblefinance/hsd.js
  humblefinance/base64.js
  humblefinance/canvas2image.js
  humblefinance/canvastext.js
  humblefinance/data.js
  humblefinance/demo.js
  humblefinance/excanvas.js
  humblefinance/Finance.js
  humblefinance/flotr.js
  humblefinance/HumbleFinance.js
  humblefinance/prototype.min.js
  d3.v2.min
  d3.v3.min
  dat.gui
  queue.min
  dat.gui.min
)
