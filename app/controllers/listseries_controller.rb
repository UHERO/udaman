class ListseriesController < ApplicationController
  include Authorization

  before_action :check_authorization

  def get
    require "net/http"
    @filelist = []
    @data = []
    @filelist = JSON.parse(open("http://readtsd.herokuapp.com/listnames/json").read)
    @filelist["file_list"].each do |file|
      url = URI.parse("http://readtsd.herokuapp.com/open/#{file}/search/#{params[:name]}/json")
      req = Net::HTTP.new(url.host, url.port)
      res = req.request_get(url.path)
      @data.push(JSON.parse(res.body)) unless res.code == "500"
    end
  end
  
  def search
  end
  
  def redir
  @name = params[:name]
  redirect_to "/listseries/#{@name}"
  end

end
