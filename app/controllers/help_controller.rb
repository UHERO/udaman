class HelpController < ApplicationController
  include Authorization

  before_action :check_authorization

  def index
  end

  def data_sources
  end

  def quarantine
  end
end
