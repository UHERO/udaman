class FeatureToggle < ActiveRecord::Base

  def FeatureToggle.get_all_uhero
    FeatureToggle.where(%q{feature_toggles.universe = 'UHERO'})
  end

  def FeatureToggle.get(name, universe = 'UHERO')
    FeatureToggle.where(name: name, universe: universe).first.status ## will raise exception on non-exist
  end
end
