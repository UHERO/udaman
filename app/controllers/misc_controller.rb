class MiscController < ApplicationController
  include Authorization

  before_action :check_authorization

  def get_branch_code
    ApplicationRecord.connection.execute(<<~MYSQL) rescue raise('Update last_branch_code_number failed')
      update branch_code set last_branch_code_number = last_branch_code_number + 1
    MYSQL
    results = ApplicationRecord.connection.execute(<<~MYSQL) rescue raise('Select last_branch_code_number failed')
      select last_branch_code_number from branch_code limit 1
    MYSQL
    @code = results.to_a.pop.pop.to_i
  end
end
