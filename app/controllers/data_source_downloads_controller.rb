class DataSourceDownloadsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_data_source_download, only: [:show, :edit, :update, :destroy, :download]

  def index
    @output_files = DataSourceDownload.order(:url).all
    @domain_hash = {}
    @output_files.each do |dsd|
      @domain_hash[dsd.url.split('/')[2]] ||= []
      @domain_hash[dsd.url.split('/')[2]].push(dsd.save_path) if dsd.handle.nil?
      @domain_hash[dsd.url.split('/')[2]].push(dsd.handle) unless dsd.handle.nil?
    end
  end

  def new
    @output_file = DataSourceDownload.new
  end

  def create
    post_params = params[:data_source_download].delete(:post_parameters)
    @output_file = DataSourceDownload.new data_source_download_params
    if @output_file.save
      @output_file.process_post_params(post_params)
      redirect_to :action => 'index'
    else
      render :action => 'new'
    end
  end
  
  def update
    post_params = params[:data_source_download].delete(:post_parameters)
    respond_to do |format|
      if @output_file.update! data_source_download_params
        @output_file.process_post_params(post_params)

        format.html { redirect_to( :action => 'index',
                        :notice => 'Data Source Download successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render :action => 'edit' }
        format.xml  { render :xml => @output_file.errors,
                      :status => :unprocessable_entity }
      end
    end
  end

  def destroy
    @output_file.destroy
    redirect_to :action => 'index'
  end
  
  def download
    respond_to do |format|
      begin
        @output_file.download 
        flash[:notice] = 'Data Source Download successfully updated.'
        format.html { redirect_to( :action => 'index') }
      rescue Exception => e
        flash[:notice] = "Something went wrong: #{e.message}"
        format.html { redirect_to( :action => 'index') }
      end
    end
  end
  
  def test_url
    @test_url_status = DataSourceDownload.test_url(URI.encode(params[:change_to]))
    render :partial => 'download_test_results'
  end

  def test_save_path
    @test_save_path = DataSourceDownload.test_save_path(params[:change_to])
    render :partial => 'save_location_test_results'
  end
  
  def test_post_params
    @test_post_params = DataSourceDownload.test_post_params(params[:change_to])
    render :partial => 'parameter_formatting_test_results'
  end

  private
  def data_source_download_params
    params.require(:data_source_download).permit(:handle, :file_to_extract, :url, :save_path, :sheet_override, :notes)
  end

  def set_data_source_download
    @output_file = DataSourceDownload.find_by id: params[:id]
  end

end
