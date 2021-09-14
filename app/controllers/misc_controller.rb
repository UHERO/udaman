class MiscController < ApplicationController
  include Authorization

  before_action :check_authorization

  def get_branch_code

  end
end
