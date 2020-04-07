class FeatureTogglesController < ApplicationController
  include Authorization

  before_action :check_authorization

  def index
    @feature_toggles = FeatureToggle.get_all_uhero
  end

end
