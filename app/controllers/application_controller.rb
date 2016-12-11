class ApplicationController < ActionController::Base
  include Authorization

  before_action :check_authorization
  before_filter :authenticate_user!
  
  helper :all # include all helpers, all the time
  protect_from_forgery
end
