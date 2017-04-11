class UnitsController < ApplicationController
  before_action :set_unit, only: [:show, :edit, :update, :destroy]

  # GET /units
  def index
    @units = Unit.all
  end

  # GET /units/1
  def show
  end

  # GET /units/new
  def new
    @unit = Unit.new
  end

  # GET /units/1/edit
  def edit
  end

  # POST /units
  def create
    @unit = Unit.new(unit_params)

    if @unit.save
      redirect_to @unit, notice: 'Unit was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /units/1
  def update
    if @unit.update(unit_params)
      redirect_to @unit, notice: 'Unit was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /units/1
  def destroy
    @unit.destroy
    redirect_to units_url, notice: 'Unit was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_unit
      @unit = Unit.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def unit_params
      params.require(:unit).permit(:short_label, :long_label)
    end
end
