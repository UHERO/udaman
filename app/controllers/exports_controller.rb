class ExportsController < ApplicationController
  before_action :set_export, only: [:show, :show_table, :edit, :update, :destroy]

  # GET /exports
  def index
    @exports = Export.all
  end

  # GET /exports/1
  # GET /exports/1.csv
  def show
    respond_to do |format|
      format.csv { render :layout => false }
      format.html # show.html.erb
    end
  end

  def show_table
    @series_to_chart = @export.series.pluck :name
    if @series_to_chart.length == 0
      render 'table'
    end
    frequency = @series_to_chart[0][-1]
    dates = set_dates(frequency, params)
    @start_date = 0
    @end_date = 9999
    render 'table'
  end

  # GET /exports/new
  def new
    @export = Export.new
  end

  # GET /exports/1/edit
  def edit
  end

  # POST /exports
  def create
    @export = Export.new(export_params)

    if @export.save
      redirect_to @export, notice: 'Export was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /exports/1
  def update
    if @export.update(export_params)
      redirect_to @export, notice: 'Export was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /exports/1
  def destroy
    @export.destroy
    redirect_to exports_url, notice: 'Export was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_export
      @export = Export.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def export_params
      params.require(:export).permit(:name, :created_by, :updated_by, :owned_by)
    end

    def set_dates(frequency, params)
      case frequency
        when 'M', 'm'
          months_back = 15
          offset = 1
        when 'Q', 'q'
          months_back = 34
          offset = 4
        when 'A', 'a'
          months_back = 120
          offset = 4
        else
          return nil
      end

      if params[:num_years].nil?
        start_date = (Time.now.to_date << (months_back))
        end_date = nil
      else
        start_date = (Time.now.to_date << (12 * params[:num_years].to_i + offset))
        end_date = nil
      end
      {:start_date => start_date, :end_date => end_date}
    end
end
