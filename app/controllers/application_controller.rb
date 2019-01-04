class ApplicationController < ActionController::Base
  before_action :authenticate_user!
  
  helper :all # include all helpers, all the time
  protect_from_forgery
end
