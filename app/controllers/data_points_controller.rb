class DataPointsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def show
    @data_points = DataPoint.where(xseries_id: params[:xseries_id].to_i, date: params[:date].to_s)
  end
end
