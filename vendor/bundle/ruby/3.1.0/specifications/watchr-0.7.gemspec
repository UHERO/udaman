# -*- encoding: utf-8 -*-
# stub: watchr 0.7 ruby lib

Gem::Specification.new do |s|
  s.name = "watchr".freeze
  s.version = "0.7"

  s.required_rubygems_version = Gem::Requirement.new(">= 0".freeze) if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib".freeze]
  s.authors = ["mynyml".freeze]
  s.date = "2010-08-23"
  s.description = "Modern continious testing (flexible alternative to autotest).".freeze
  s.email = "mynyml@gmail.com".freeze
  s.executables = ["watchr".freeze]
  s.files = ["bin/watchr".freeze]
  s.homepage = "http://mynyml.com/ruby/flexible-continuous-testing".freeze
  s.rubygems_version = "3.3.27".freeze
  s.summary = "Modern continious testing (flexible alternative to autotest)".freeze

  s.installed_by_version = "3.3.27" if s.respond_to? :installed_by_version

  if s.respond_to? :specification_version then
    s.specification_version = 3
  end

  if s.respond_to? :add_runtime_dependency then
    s.add_development_dependency(%q<minitest>.freeze, [">= 0"])
    s.add_development_dependency(%q<mocha>.freeze, [">= 0"])
    s.add_development_dependency(%q<every>.freeze, [">= 0"])
  else
    s.add_dependency(%q<minitest>.freeze, [">= 0"])
    s.add_dependency(%q<mocha>.freeze, [">= 0"])
    s.add_dependency(%q<every>.freeze, [">= 0"])
  end
end
