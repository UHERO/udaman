class ApplicationController < ActionController::Base
  before_filter :authenticate_user!
  
  helper :all # include all helpers, all the time
  protect_from_forgery
end
