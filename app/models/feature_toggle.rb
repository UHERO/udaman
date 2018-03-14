class FeatureToggle < ActiveRecord::Base

  def FeatureToggle.get_all_uhero
    FeatureToggle.where(%q{feature_toggles.universe = 'UHERO'})
  end

end
