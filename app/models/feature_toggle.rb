class FeatureToggle < ActiveRecord::Base

  def FeatureToggle.get_all_uhero
    FeatureToggle.where(%q{feature_toggles.universe = 'UHERO'})
  end

  def FeatureToggle.is_set(name, default, universe = 'UHERO')
    toggle = FeatureToggle.find_by(name: name, universe: universe)
    return toggle.status if toggle
    Rails.logger.debug { "Feature toggle #{name} not existent in universe #{universe}" }
    default
  end
end
