class ForecastSnapshotsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_forecast_snapshot, only: [:show, :edit, :update, :destroy, :new_assoc_tsd]

  # GET /forecast_snapshots
  def index
    @forecast_snapshots = ForecastSnapshot.all
  end

  # GET /forecast_snapshots/1
  def show
  end

  # GET /forecast_snapshots/new
  def new
    @forecast_snapshot = ForecastSnapshot.new
  end

  # GET /forecast_snapshots/1/edit
  def edit
  end

  # POST /forecast_snapshots
  def create
    @forecast_snapshot = ForecastSnapshot.new(forecast_snapshot_params)

    if @forecast_snapshot.save
      redirect_to @forecast_snapshot, notice: 'Forecast snapshot was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /forecast_snapshots/1
  def update
    if @forecast_snapshot.update(forecast_snapshot_params)
      redirect_to @forecast_snapshot, notice: 'Forecast snapshot was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /forecast_snapshots/1
  def destroy
    @forecast_snapshot.destroy
    redirect_to forecast_snapshots_url, notice: 'Forecast snapshot was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_forecast_snapshot
      @forecast_snapshot = ForecastSnapshot.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def forecast_snapshot_params
      params.require(:forecast_snapshot).permit(:name, :version, :comments, :published)
    end
end
