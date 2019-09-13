class ApplicationController < ActionController::Base
  before_action :authenticate_user!
  
  helper :all # include all helpers, all the time
  protect_from_forgery

  ## Wrote this nice method and then found I don't have any need for it. Hope you find it when you need it later.
  def redirect_back_or_default(default: root_path, **args)
    redirect_back fallback_location: default, allow_other_host: false, **args
  end

end
