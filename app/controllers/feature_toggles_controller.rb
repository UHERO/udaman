class FeatureTogglesController < ApplicationController

  def index
    @feature_toggles = FeatureToggle.get_all_uhero
  end

end
