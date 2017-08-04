class FeatureTogglesController < ApplicationController

  def index
    @feature_toggles = FeatureToggle.where(universe: 'UHERO').all
  end

end
