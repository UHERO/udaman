# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'rails-assets-select2/version'

Gem::Specification.new do |spec|
  spec.name          = "rails-assets-select2"
  spec.version       = RailsAssetsSelect2::VERSION
  spec.authors       = ["rails-assets.org"]
  spec.description   = "Select2 is a jQuery based replacement for select boxes. It supports searching, remote data sets, and infinite scrolling of results."
  spec.summary       = "Select2 is a jQuery based replacement for select boxes. It supports searching, remote data sets, and infinite scrolling of results."
  spec.homepage      = "https://github.com/ivaynberg/select2"
  spec.license       = "MIT"

  spec.files         = `find ./* -type f | cut -b 3-`.split($/)
  spec.require_paths = ["lib"]

  spec.add_development_dependency "bundler", "~> 1.3"
  spec.add_development_dependency "rake"
end
