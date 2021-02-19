class ReloadJobsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def index
    @all_jobs = ReloadJob.all.order(created_at: :desc)
  end

end
