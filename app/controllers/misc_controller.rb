class MiscController < ApplicationController
  include Authorization

  before_action :check_authorization

  def index
  end
end
