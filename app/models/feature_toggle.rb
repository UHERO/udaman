class FeatureToggle < ActiveRecord::Base

  def FeatureToggle.get_all_uhero
    FeatureToggle.where(%q{feature_toggles.universe = 'UHERO'})
  end

  def FeatureToggle.is_set(name, universe = 'UHERO', default = false)
    FeatureToggle.find_by(name: name, universe: universe).status rescue default
  end
end
