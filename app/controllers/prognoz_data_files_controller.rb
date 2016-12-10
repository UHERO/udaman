class PrognozDataFilesController < ApplicationController
  def index
    @output_files = PrognozDataFile.all.order :name
  end

  def new
    @output_file = PrognozDataFile.new
  end

  def show
    @output_file = PrognozDataFile.find_by id: params[:id]
    @diffs = @output_file.udaman_diffs
  end

  def edit
    @output_file = PrognozDataFile.find_by id: params[:id]
  end
  
  def create
    @output_file = PrognozDataFile.new(params[:prognoz_data_file])
    if @output_file.save
      redirect_to :action => 'index'
    else
      render :action => 'new'
    end
  end
  
  def update
    @output_file = PrognozDataFile.find_by id: params[:id]
    respond_to do |format|
      if @output_file.update! prognoz_data_file_params
        format.html { redirect_to(@output_file,
                        :notice => 'Prognoz Output File successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render :action => 'edit' }
        format.xml  { render :xml => @output_file.errors,
                      :status => :unprocessable_entity }
      end
    end
  end

  def destroy
    @output_file = PrognozDataFile.find_by id: params[:id]
    @output_file.destroy
    
    redirect_to :action => 'index'
  end

  def load_from_file
    @output_file = PrognozDataFile.find_by id: params[:id]
    results = @output_file.load
    #@output_file.load_series_validated
    redirect_to(:action => 'index', :notice => results[:notice])
  end
  
  def write_xls
    @output_file = PrognozDataFile.find_by id: params[:id]
    @output_file.write_export
    redirect_to :action => 'index'
  end
  
  def send_prognoz_export
    @recipients = %w(ashleysh@hawaii.edu fuleky@hawaii.edu james29@hawaii.edu jrpage@hawaii.edu vward@hawaii.edu djiann@hawaii.edu)
    PrognozDataFile.send_prognoz_update(@recipients)
    flash[:notice] = "Zipped Export was sent to [#{@recipients.join(', ')}]. Comparison files were updated in /data/prognoz_export."
    redirect_to :action => 'index'
  end

  private
    def prognoz_data_file_params
      params.require(:prognoz_data_file).permit(:name, :filename)
    end
end
