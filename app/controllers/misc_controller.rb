class MiscController < ApplicationController
  include Authorization

  before_action :check_authorization

  def get_branch_code
    @code = get_branch_code_sql
  end
end
